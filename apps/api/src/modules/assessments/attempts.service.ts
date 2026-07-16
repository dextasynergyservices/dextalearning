import { randomBytes } from "node:crypto";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type {
	Assessment,
	AssessmentAttempt,
	Question,
} from "../../../generated/prisma/client";
import type { AuthenticatedUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";
import { AI_PORT, type AiPort } from "../../shared/ai/ai.port";
import {
	type AttemptSubmittedEvent,
	LearningEvents,
} from "../../shared/events/learning-events";
import { computeRetryState } from "../../shared/retry/retry-policy.calculator";
import {
	STORAGE_PORT,
	type StoragePort,
} from "../../shared/storage/storage.port";
import { CompletionService } from "../completion/completion.service";
import type { UploadFile } from "../media/media.constants";
import { isFinalAssessmentScope } from "./assessment-scopes";
import {
	calculateIntegrity,
	calculateScore,
	detectFastAnswers,
	isAnswerCorrect,
	isPassed,
	resolveSeverity,
	shouldAutoSubmit,
} from "./attempts.calculator";
import type {
	IngestAntiCheatDto,
	SaveAnswerDto,
	SubmitAttemptDto,
} from "./dto/attempts.dto";

const PROCTORING_IMAGE_TYPES: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};
const MAX_PROCTORING_BYTES = 1_500_000;

/** Snapshot of a single attempt, stored in `answersJson` (server-owned). */
interface AttemptSnapshot {
	questions: {
		id: string;
		type: string | null;
		body: string;
		points: number;
		options: string[] | null;
	}[];
	answers: Record<string, string>;
	answeredAt: Record<string, string>;
	/** Per-question correctness frozen at grading (incl. AI short-answer). */
	correct?: Record<string, boolean>;
}

function shuffle<T>(input: T[]): T[] {
	const arr = [...input];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

/**
 * Learner-facing attempt engine (§4.6.3): the server owns the attempt record,
 * the timer (start = authoritative), attempt locking (one in-progress attempt),
 * server-side grading, IP/UA logging and fast-answer flagging. Clients cannot
 * extend the timer or grade locally.
 */
@Injectable()
export class AttemptsService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(STORAGE_PORT) private readonly storage: StoragePort,
		@Inject(AI_PORT) private readonly ai: AiPort,
		private readonly events: EventEmitter2,
		private readonly completion: CompletionService,
	) {}

	// ── Timer helpers ─────────────────────────────────────────────────────────
	private expiresAt(
		assessment: Assessment,
		attempt: AssessmentAttempt,
	): number | null {
		if (!assessment.timeLimitMinutes) return null;
		return (
			new Date(attempt.startedAt).getTime() +
			assessment.timeLimitMinutes * 60_000
		);
	}

	private remainingSeconds(
		assessment: Assessment,
		attempt: AssessmentAttempt,
	): number | null {
		const exp = this.expiresAt(assessment, attempt);
		return exp == null
			? null
			: Math.max(0, Math.floor((exp - Date.now()) / 1000));
	}

	private isExpired(
		assessment: Assessment,
		attempt: AssessmentAttempt,
	): boolean {
		const exp = this.expiresAt(assessment, attempt);
		return exp != null && Date.now() > exp && !attempt.submittedAt;
	}

	private snapOf(attempt: AssessmentAttempt): AttemptSnapshot {
		return (
			(attempt.answersJson as unknown as AttemptSnapshot) ?? {
				questions: [],
				answers: {},
				answeredAt: {},
			}
		);
	}

	/**
	 * Is the final open yet (§4.3)? A final examines the course/path/cohort, so
	 * it only unlocks once that work is done — asked of the Completion context,
	 * never re-derived here (§6.4). Formative quizzes have nothing to gate on.
	 */
	private async prerequisitesMet(
		user: AuthenticatedUser,
		assessment: Assessment,
	): Promise<boolean> {
		if (!isFinalAssessmentScope(assessment.scope)) return true;
		const parent = assessment.courseId
			? (["course", assessment.courseId] as const)
			: assessment.pathId
				? (["path", assessment.pathId] as const)
				: assessment.cohortId
					? (["cohort", assessment.cohortId] as const)
					: null;
		if (!parent) return true;
		const { unlocked } = await this.completion.getFinalsGate(
			user,
			parent[0],
			parent[1],
		);
		return unlocked;
	}

	// ── Eligibility / retake rules (§4.4) ─────────────────────────────────────
	private async eligibility(
		user: AuthenticatedUser,
		assessment: Assessment,
		questionCount: number,
	) {
		const userId = user.id;
		const submitted = await this.prisma.assessmentAttempt.findMany({
			where: {
				userId,
				assessmentId: assessment.id,
				submittedAt: { not: null },
			},
			orderBy: { submittedAt: "desc" },
		});
		// Invalidated attempts don't count — invalidating frees a retake (§4.6.4).
		const attempts = submitted.filter((a) => !a.invalidated);
		const attemptsUsed = attempts.length;
		const bestScore = attempts.reduce(
			(max, a) => Math.max(max, a.score ? Number(a.score) : 0),
			0,
		);

		// Shared three-knob retry model (attempts + spacing + post-exhaustion
		// lockout). maxRetakes is expressed as *retakes*, so total tries = +1.
		// Only finals carry a policy (§4.4.1) — lesson/module quizzes are
		// formative and stay unlimited and immediate.
		const policied = isFinalAssessmentScope(assessment.scope);
		const retry = computeRetryState(
			attempts
				.filter((a) => a.submittedAt)
				.map((a) => ({
					submittedAt: a.submittedAt as Date,
					passed: a.passed === true,
				})),
			{
				maxAttempts:
					!policied || assessment.maxRetakes == null
						? null
						: assessment.maxRetakes + 1,
				spacingHours: policied
					? (assessment.retakeCooldownHours ?? null)
					: null,
				lockoutDays: policied ? (assessment.retakeLockoutDays ?? null) : null,
			},
		);

		let canStart = retry.canRetry;
		// Preserve the frontend's existing reason vocabulary.
		let reason: string | undefined =
			retry.reason === "no_attempts_left" ? "no_retakes_left" : retry.reason;

		// The final stays shut until the work it examines is done (§4.3) — checked
		// after the cheap in-memory rules, since it hits the completion engine.
		let prereqOk = true;
		if (canStart) {
			prereqOk = await this.prerequisitesMet(user, assessment);
			if (!prereqOk) {
				canStart = false;
				reason = "prerequisites";
			}
		}

		if (questionCount === 0) {
			canStart = false;
			reason = "no_questions";
		}

		return {
			canStart,
			reason,
			/** False when the final is still locked behind unfinished work (§4.3). */
			prerequisitesMet: prereqOk,
			attemptsUsed,
			retakesRemaining: retry.attemptsRemaining,
			alreadyPassed: retry.alreadyPassed,
			bestScore,
			cooldownUntil: retry.nextAttemptAt,
			lockedUntil: retry.lockedUntil,
			lastAttemptId: attempts[0]?.id ?? null,
		};
	}

	private anticheat(assessment: Assessment) {
		return {
			tabSwitchLimit: assessment.anticheatTabSwitchLimit,
			fullscreenRequired: assessment.anticheatFullscreenRequired,
			cameraRequired: assessment.anticheatCameraRequired,
			copyPasteBlocked: assessment.anticheatCopyPasteBlocked,
		};
	}

	// ── Public: learner-facing assessment info ────────────────────────────────
	async getInfo(user: AuthenticatedUser, assessmentId: string) {
		const assessment = await this.prisma.assessment.findUnique({
			where: { id: assessmentId },
			include: { _count: { select: { questions: true } } },
		});
		if (!assessment) throw new NotFoundException("Assessment not found");

		const elig = await this.eligibility(
			user,
			assessment,
			assessment._count.questions,
		);
		const inProgress = await this.prisma.assessmentAttempt.findFirst({
			where: { userId: user.id, assessmentId, submittedAt: null },
			orderBy: { startedAt: "desc" },
			select: { id: true },
		});

		return {
			id: assessment.id,
			title: assessment.title,
			scope: assessment.scope,
			passMark: Number(assessment.passMark),
			timeLimitMinutes: assessment.timeLimitMinutes,
			questionCount: assessment._count.questions,
			// The *effective* policy: a formative quiz reports none, whatever
			// stale values may sit on its row (§4.4.1).
			hasRetryPolicy: isFinalAssessmentScope(assessment.scope),
			maxRetakes: isFinalAssessmentScope(assessment.scope)
				? assessment.maxRetakes
				: null,
			retakeCooldownHours: isFinalAssessmentScope(assessment.scope)
				? assessment.retakeCooldownHours
				: null,
			retakeLockoutDays: isFinalAssessmentScope(assessment.scope)
				? assessment.retakeLockoutDays
				: null,
			anticheat: this.anticheat(assessment),
			inProgressAttemptId: inProgress?.id ?? null,
			...elig,
		};
	}

	// ── Public: start or resume ───────────────────────────────────────────────
	async startOrResume(
		user: AuthenticatedUser,
		assessmentId: string,
		ip: string | undefined,
		userAgent: string | undefined,
	) {
		const assessment = await this.prisma.assessment.findUnique({
			where: { id: assessmentId },
			include: { questions: { orderBy: { orderIndex: "asc" } } },
		});
		if (!assessment) throw new NotFoundException("Assessment not found");

		// Resume an existing in-progress attempt (attempt locking — §4.6.3).
		const existing = await this.prisma.assessmentAttempt.findFirst({
			where: { userId: user.id, assessmentId, submittedAt: null },
			orderBy: { startedAt: "desc" },
		});
		if (existing) {
			if (this.isExpired(assessment, existing)) {
				await this.finalize(assessment, existing, this.snapOf(existing), true);
			} else {
				return this.toState(assessment, existing);
			}
		}

		const elig = await this.eligibility(
			user,
			assessment,
			assessment.questions.length,
		);
		if (!elig.canStart) {
			throw new ConflictException({
				code: "NOT_ELIGIBLE",
				message: this.reasonMessage(elig.reason),
				details: elig,
			});
		}

		const snapshot = this.buildSnapshot(assessment);
		const created = await this.prisma.assessmentAttempt.create({
			data: {
				assessmentId,
				userId: user.id,
				attemptNumber: elig.attemptsUsed + 1,
				ipAddress: ip?.slice(0, 45),
				userAgent: userAgent?.slice(0, 1000),
				answersJson: snapshot as object,
			},
		});
		return this.toState(assessment, created);
	}

	private reasonMessage(reason?: string): string {
		switch (reason) {
			case "no_questions":
				return "This assessment has no questions yet.";
			case "already_passed":
				return "You have already passed this assessment.";
			case "no_retakes_left":
				return "You have no retakes left for this assessment.";
			case "cooldown":
				return "Please wait before retaking this assessment.";
			case "locked_out":
				return "You have used all your retakes. You can try again once the cooldown ends.";
			case "prerequisites":
				return "Finish all the lessons and module quizzes before taking the final assessment.";
			default:
				return "You cannot start this assessment right now.";
		}
	}

	private buildSnapshot(
		assessment: Assessment & { questions: Question[] },
	): AttemptSnapshot {
		let qs = [...assessment.questions];
		if (assessment.shuffleQuestions) qs = shuffle(qs);
		if (
			assessment.questionPoolSize &&
			assessment.questionPoolSize < qs.length
		) {
			qs = qs.slice(0, assessment.questionPoolSize);
		}
		const questions = qs.map((q) => {
			let options = Array.isArray(q.optionsJson)
				? (q.optionsJson as string[])
				: null;
			if (options && assessment.shuffleAnswers) options = shuffle(options);
			return {
				id: q.id,
				type: q.type,
				body: q.body,
				points: q.points,
				options,
			};
		});
		return { questions, answers: {}, answeredAt: {} };
	}

	// ── Public: get attempt (resume/poll) ─────────────────────────────────────
	async getAttempt(user: AuthenticatedUser, attemptId: string) {
		const { assessment, attempt } = await this.loadOwnedAttempt(
			user,
			attemptId,
		);
		if (attempt.submittedAt) {
			return {
				status: "submitted" as const,
				result: await this.toResultFromAttempt(assessment, attempt),
			};
		}
		if (this.isExpired(assessment, attempt)) {
			const finalized = await this.finalize(
				assessment,
				attempt,
				this.snapOf(attempt),
				true,
			);
			return { status: "submitted" as const, result: finalized };
		}
		return {
			status: "in_progress" as const,
			state: this.toState(assessment, attempt),
		};
	}

	// ── Public: save one answer ───────────────────────────────────────────────
	async saveAnswer(
		user: AuthenticatedUser,
		attemptId: string,
		dto: SaveAnswerDto,
	) {
		const { assessment, attempt } = await this.loadOwnedAttempt(
			user,
			attemptId,
		);
		if (attempt.submittedAt) {
			throw new BadRequestException("This attempt is already submitted.");
		}
		if (this.isExpired(assessment, attempt)) {
			const result = await this.finalize(
				assessment,
				attempt,
				this.snapOf(attempt),
				true,
			);
			throw new ConflictException({
				code: "TIME_UP",
				message: "Time is up — your attempt was submitted automatically.",
				details: { result },
			});
		}
		const snap = this.snapOf(attempt);
		if (!snap.questions.some((q) => q.id === dto.questionId)) {
			throw new BadRequestException("Question is not part of this attempt.");
		}
		snap.answers[dto.questionId] = dto.answer;
		snap.answeredAt[dto.questionId] = new Date().toISOString();
		await this.prisma.assessmentAttempt.update({
			where: { id: attemptId },
			data: { answersJson: snap as object },
		});
		return {
			saved: true,
			remainingSeconds: this.remainingSeconds(assessment, attempt),
		};
	}

	// ── Anti-cheat (§4.6.1/§4.6.4) ────────────────────────────────────────────
	/** Recompute + persist the attempt's integrity score from all its logs. */
	private async recomputeIntegrity(attemptId: string) {
		const logs = await this.prisma.assessmentAntiCheatLog.findMany({
			where: { attemptId },
			select: { eventType: true, severity: true },
		});
		const { integrityScore, flagCount, cameraMonitorFailed } =
			calculateIntegrity(logs);
		await this.prisma.assessmentAttempt.update({
			where: { id: attemptId },
			data: {
				integrityScore,
				flagCount,
				// Only ever set to false here — a later clean recompute must not
				// erase the fact that monitoring failed at some point in the attempt.
				...(cameraMonitorFailed ? { cameraMonitored: false } : {}),
			},
		});
		const counts: Record<string, number> = {};
		for (const l of logs) counts[l.eventType] = (counts[l.eventType] ?? 0) + 1;
		return { integrityScore, flagCount, counts, cameraMonitorFailed };
	}

	/**
	 * Batch-ingest client anti-cheat events (§4.6.3), recompute the integrity
	 * score from all logs, and report whether a threshold (tab switches /
	 * fullscreen exits) was crossed so the client can auto-submit.
	 */
	async ingestAntiCheat(
		user: AuthenticatedUser,
		attemptId: string,
		dto: IngestAntiCheatDto,
	) {
		const { assessment, attempt } = await this.loadOwnedAttempt(
			user,
			attemptId,
		);
		if (attempt.submittedAt) {
			return {
				accepted: 0,
				flagCount: attempt.flagCount,
				integrityScore: attempt.integrityScore,
				autoSubmit: false,
				tabSwitches: 0,
				tabSwitchLimit: assessment.anticheatTabSwitchLimit,
			};
		}

		const rows = dto.events.slice(0, 100).map((e) => ({
			attemptId,
			eventType: e.eventType,
			severity: resolveSeverity(e.eventType, e.severity),
			occurredAt: e.occurredAt ? new Date(e.occurredAt) : new Date(),
			metadataJson: (e.metadata ?? undefined) as object | undefined,
			screenshotKey: e.screenshotKey,
		}));
		if (rows.length > 0) {
			await this.prisma.assessmentAntiCheatLog.createMany({ data: rows });
		}

		const { integrityScore, flagCount, counts } =
			await this.recomputeIntegrity(attemptId);
		const tabSwitches = counts.tab_switch ?? 0;
		const fullscreenExits = counts.fullscreen_exit ?? 0;
		const autoSubmit = shouldAutoSubmit({
			tabSwitches,
			tabSwitchLimit: assessment.anticheatTabSwitchLimit,
			fullscreenExits,
			fullscreenRequired: assessment.anticheatFullscreenRequired,
		});

		return {
			accepted: rows.length,
			flagCount,
			integrityScore,
			autoSubmit,
			tabSwitches,
			tabSwitchLimit: assessment.anticheatTabSwitchLimit,
		};
	}

	/**
	 * Camera-monitoring snapshot (§4.6.2): store the thumbnail in R2 under
	 * `proctoring/{attemptId}/`, log the camera flag with its screenshot key, and
	 * recompute integrity. No continuous stream is ever sent — only flagged frames.
	 */
	async ingestProctoringSnapshot(
		user: AuthenticatedUser,
		attemptId: string,
		file: UploadFile,
		eventType: string,
	) {
		const { attempt } = await this.loadOwnedAttempt(user, attemptId);
		if (attempt.submittedAt) {
			return {
				stored: false,
				flagCount: attempt.flagCount,
				integrityScore: attempt.integrityScore,
			};
		}
		if (
			eventType !== "camera_face_missing" &&
			eventType !== "camera_multiple_faces"
		) {
			throw new BadRequestException("Invalid proctoring event type.");
		}
		const ext = PROCTORING_IMAGE_TYPES[file.mimetype];
		if (!ext) {
			throw new UnprocessableEntityException({
				code: "UNSUPPORTED_IMAGE",
				message: "Snapshot must be a JPEG, PNG or WebP image.",
			});
		}
		if (file.size > MAX_PROCTORING_BYTES) {
			throw new UnprocessableEntityException({
				code: "IMAGE_TOO_LARGE",
				message: "Snapshot is too large.",
			});
		}

		const key = `proctoring/${attemptId}/${Date.now()}-${randomBytes(
			3,
		).toString("hex")}.${ext}`;
		await this.storage.putObject(key, file.buffer, file.mimetype);
		await this.prisma.assessmentAntiCheatLog.create({
			data: {
				attemptId,
				eventType,
				severity: resolveSeverity(eventType),
				screenshotKey: key,
			},
		});
		const { integrityScore, flagCount } =
			await this.recomputeIntegrity(attemptId);
		return { stored: true, screenshotKey: key, integrityScore, flagCount };
	}

	// ── Public: submit ────────────────────────────────────────────────────────
	async submit(
		user: AuthenticatedUser,
		attemptId: string,
		dto: SubmitAttemptDto,
	) {
		const { assessment, attempt } = await this.loadOwnedAttempt(
			user,
			attemptId,
		);
		if (attempt.submittedAt) {
			return this.toResultFromAttempt(assessment, attempt);
		}
		const snap = this.snapOf(attempt);
		if (dto?.answers) {
			for (const [qid, val] of Object.entries(dto.answers)) {
				if (snap.questions.some((q) => q.id === qid)) {
					snap.answers[qid] = String(val);
					if (!snap.answeredAt[qid]) {
						snap.answeredAt[qid] = new Date().toISOString();
					}
				}
			}
		}
		const autoSubmitted = this.isExpired(assessment, attempt);
		return this.finalize(assessment, attempt, snap, autoSubmitted);
	}

	// ── Public: get result ────────────────────────────────────────────────────
	async getResult(user: AuthenticatedUser, attemptId: string) {
		const { assessment, attempt } = await this.loadOwnedAttempt(
			user,
			attemptId,
		);
		if (!attempt.submittedAt) {
			throw new BadRequestException("This attempt has not been submitted yet.");
		}
		return this.toResultFromAttempt(assessment, attempt);
	}

	// ── Grading + finalisation ────────────────────────────────────────────────
	private async finalize(
		assessment: Assessment,
		attempt: AssessmentAttempt,
		snap: AttemptSnapshot,
		autoSubmitted: boolean,
	) {
		const ids = snap.questions.map((q) => q.id);
		const questions = await this.prisma.question.findMany({
			where: { id: { in: ids } },
		});
		const byId = new Map(questions.map((q) => [q.id, q]));

		// First pass: deterministic grading (free). Short-answer that fails the
		// exact match is queued for AI semantic grading (§4.4) so paraphrases and
		// answers written in another language still count.
		const correct = new Map<string, boolean>();
		const aiCandidates: {
			qid: string;
			question: string;
			expected: string;
			given: string;
		}[] = [];
		for (const sq of snap.questions) {
			const q = byId.get(sq.id);
			const answer = snap.answers[sq.id];
			const exact = isAnswerCorrect(q, answer);
			correct.set(sq.id, exact);
			if (
				!exact &&
				q?.type === "short_answer" &&
				(answer ?? "").trim().length > 0 &&
				(q.correctAnswer ?? "").trim().length > 0
			) {
				aiCandidates.push({
					qid: sq.id,
					question: q.body,
					expected: q.correctAnswer ?? "",
					given: answer ?? "",
				});
			}
		}
		// Only one batched AI call, and only when there are short-answer misses.
		if (aiCandidates.length > 0) {
			try {
				const verdicts = await this.ai.gradeShortAnswers(
					aiCandidates.map((c) => ({
						question: c.question,
						expected: c.expected,
						given: c.given,
					})),
				);
				aiCandidates.forEach((c, i) => {
					if (verdicts[i]) correct.set(c.qid, true);
				});
			} catch {
				// AI unavailable → keep the strict exact-match result (fail-safe).
			}
		}

		const scoredQuestions = snap.questions.map((sq) => {
			const q = byId.get(sq.id);
			return {
				points: q?.points ?? sq.points ?? 1,
				correct: !!correct.get(sq.id),
			};
		});
		// Freeze the graded correctness so the review matches the score (§4.4).
		snap.correct = Object.fromEntries(correct);
		const { score } = calculateScore(scoredQuestions);
		const passed = isPassed(score, Number(assessment.passMark));

		const fastFlags = detectFastAnswers({
			thresholdSeconds: assessment.anticheatTimePerQuestionFlagSeconds ?? 2,
			startedAt: attempt.startedAt,
			answeredAt: snap.answeredAt,
		});

		const updated = await this.prisma.$transaction(async (tx) => {
			if (fastFlags.length > 0) {
				await tx.assessmentAntiCheatLog.createMany({
					data: fastFlags.map((f) => ({
						attemptId: attempt.id,
						eventType: "fast_answer" as const,
						severity: "low" as const,
						metadataJson: f as object,
					})),
				});
			}
			// Integrity reflects ALL flags — server fast-answer + client-ingested (§4.6.4).
			// `eventType` is required, not cosmetic: it's how system events are told
			// apart from accusations (§4.6.2).
			const logs = await tx.assessmentAntiCheatLog.findMany({
				where: { attemptId: attempt.id },
				select: { severity: true, eventType: true },
			});
			const { integrityScore, flagCount, cameraMonitorFailed } =
				calculateIntegrity(logs);
			return tx.assessmentAttempt.update({
				where: { id: attempt.id },
				data: {
					answersJson: snap as object,
					submittedAt: new Date(),
					gradedAt: new Date(),
					autoSubmitted,
					score,
					passed,
					flagCount,
					integrityScore,
					...(cameraMonitorFailed ? { cameraMonitored: false } : {}),
				},
			});
		});

		// Every finalize is a new attempt entity — emit unconditionally (§6.4);
		// Engagement/Reminders subscribe, this context never calls them.
		if (updated.userId) {
			this.events.emit(LearningEvents.AttemptSubmitted, {
				userId: updated.userId,
				assessmentId: assessment.id,
				lessonId: assessment.lessonId,
				scope: assessment.scope,
				score,
				passed,
				attemptNumber: updated.attemptNumber,
			} satisfies AttemptSubmittedEvent);
		}

		return this.toResult(assessment, updated, questions);
	}

	// ── Serialisers ───────────────────────────────────────────────────────────
	private toState(assessment: Assessment, attempt: AssessmentAttempt) {
		const snap = this.snapOf(attempt);
		return {
			status: "in_progress" as const,
			attemptId: attempt.id,
			assessmentId: assessment.id,
			title: assessment.title,
			attemptNumber: attempt.attemptNumber,
			timeLimitMinutes: assessment.timeLimitMinutes,
			remainingSeconds: this.remainingSeconds(assessment, attempt),
			passMark: Number(assessment.passMark),
			anticheat: this.anticheat(assessment),
			questions: snap.questions.map((q) => ({
				id: q.id,
				type: q.type,
				body: q.body,
				points: q.points,
				options: q.options,
			})),
			answers: snap.answers,
		};
	}

	private async toResult(
		assessment: Assessment,
		attempt: AssessmentAttempt,
		questions: Question[],
	) {
		const snap = this.snapOf(attempt);
		const byId = new Map(questions.map((q) => [q.id, q]));
		// Growth framing (§3.1 Dweck): the result leads with "you've grown X%"
		// against the learner's best PRIOR valid attempt, not the raw score.
		const previous = await this.prisma.assessmentAttempt.findFirst({
			where: {
				assessmentId: assessment.id,
				userId: attempt.userId,
				id: { not: attempt.id },
				submittedAt: { not: null },
				invalidated: false,
				score: { not: null },
			},
			orderBy: { score: "desc" },
			select: { score: true },
		});
		const score = attempt.score == null ? 0 : Number(attempt.score);
		const previousBest =
			previous?.score == null ? null : Number(previous.score);
		return {
			status: "submitted" as const,
			attemptId: attempt.id,
			assessmentId: assessment.id,
			title: assessment.title,
			attemptNumber: attempt.attemptNumber,
			submittedAt: attempt.submittedAt,
			autoSubmitted: attempt.autoSubmitted,
			score,
			previousBest,
			delta: previousBest == null ? null : score - previousBest,
			passed: attempt.passed,
			passMark: Number(assessment.passMark),
			integrityScore: attempt.integrityScore,
			flagCount: attempt.flagCount,
			review: snap.questions.map((sq) => {
				const q = byId.get(sq.id);
				return {
					id: sq.id,
					type: sq.type,
					body: sq.body,
					options: sq.options,
					points: q?.points ?? sq.points ?? 1,
					yourAnswer: snap.answers[sq.id] ?? null,
					correctAnswer: q?.correctAnswer ?? null,
					// Use the frozen graded result (incl. AI); fall back for older attempts.
					correct:
						snap.correct?.[sq.id] ?? isAnswerCorrect(q, snap.answers[sq.id]),
				};
			}),
		};
	}

	private async toResultFromAttempt(
		assessment: Assessment,
		attempt: AssessmentAttempt,
	) {
		const ids = this.snapOf(attempt).questions.map((q) => q.id);
		const questions = await this.prisma.question.findMany({
			where: { id: { in: ids } },
		});
		return this.toResult(assessment, attempt, questions);
	}

	private async loadOwnedAttempt(user: AuthenticatedUser, attemptId: string) {
		const attempt = await this.prisma.assessmentAttempt.findUnique({
			where: { id: attemptId },
		});
		if (!attempt) throw new NotFoundException("Attempt not found");
		if (attempt.userId !== user.id) {
			throw new ForbiddenException("This attempt belongs to another learner.");
		}
		if (!attempt.assessmentId)
			throw new NotFoundException("Assessment not found");
		const assessment = await this.prisma.assessment.findUnique({
			where: { id: attempt.assessmentId },
		});
		if (!assessment) throw new NotFoundException("Assessment not found");
		return { attempt, assessment };
	}
}
