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
import type {
	Assessment,
	AssessmentAttempt,
	Question,
} from "../../../generated/prisma/client";
import type { AuthenticatedUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";
import { AI_PORT, type AiPort } from "../../shared/ai/ai.port";
import {
	STORAGE_PORT,
	type StoragePort,
} from "../../shared/storage/storage.port";
import type { UploadFile } from "../media/media.constants";
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

	// ── Eligibility / retake rules (§4.4) ─────────────────────────────────────
	private async eligibility(
		userId: string,
		assessment: Assessment,
		questionCount: number,
	) {
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
		const alreadyPassed = attempts.some((a) => a.passed === true);
		const bestScore = attempts.reduce(
			(max, a) => Math.max(max, a.score ? Number(a.score) : 0),
			0,
		);
		const allowedTotal =
			assessment.maxRetakes == null
				? Number.POSITIVE_INFINITY
				: assessment.maxRetakes + 1;
		const retakesRemaining = Number.isFinite(allowedTotal)
			? Math.max(0, allowedTotal - attemptsUsed)
			: null;

		let canStart = true;
		let reason: string | undefined;
		let cooldownUntil: string | null = null;

		if (questionCount === 0) {
			canStart = false;
			reason = "no_questions";
		} else if (alreadyPassed) {
			canStart = false;
			reason = "already_passed";
		} else if (retakesRemaining === 0) {
			canStart = false;
			reason = "no_retakes_left";
		} else if (assessment.retakeCooldownHours && attempts[0]?.submittedAt) {
			const until =
				new Date(attempts[0].submittedAt).getTime() +
				assessment.retakeCooldownHours * 3_600_000;
			if (until > Date.now()) {
				canStart = false;
				reason = "cooldown";
				cooldownUntil = new Date(until).toISOString();
			}
		}

		return {
			canStart,
			reason,
			attemptsUsed,
			retakesRemaining,
			alreadyPassed,
			bestScore,
			cooldownUntil,
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
			user.id,
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
			maxRetakes: assessment.maxRetakes,
			retakeCooldownHours: assessment.retakeCooldownHours,
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
			user.id,
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
	private static readonly SEVERITY_WEIGHT: Record<string, number> = {
		low: 2,
		medium: 5,
		high: 10,
	};

	private static readonly DEFAULT_SEVERITY: Record<
		string,
		"low" | "medium" | "high"
	> = {
		tab_switch: "medium",
		focus_loss: "low",
		copy_attempt: "medium",
		paste_attempt: "medium",
		right_click: "low",
		keyboard_shortcut: "low",
		fullscreen_exit: "high",
		camera_face_missing: "medium",
		camera_multiple_faces: "high",
		fast_answer: "low",
		viewport_change: "low",
		devtools_open: "high",
	};

	private integrityFromLogs(logs: { severity: string }[]) {
		const penalty = logs.reduce(
			(sum, l) => sum + (AttemptsService.SEVERITY_WEIGHT[l.severity] ?? 0),
			0,
		);
		return {
			integrityScore: Math.max(0, 100 - penalty),
			flagCount: logs.length,
		};
	}

	/** Recompute + persist the attempt's integrity score from all its logs. */
	private async recomputeIntegrity(attemptId: string) {
		const logs = await this.prisma.assessmentAntiCheatLog.findMany({
			where: { attemptId },
			select: { eventType: true, severity: true },
		});
		const { integrityScore, flagCount } = this.integrityFromLogs(logs);
		await this.prisma.assessmentAttempt.update({
			where: { id: attemptId },
			data: { integrityScore, flagCount },
		});
		const counts: Record<string, number> = {};
		for (const l of logs) counts[l.eventType] = (counts[l.eventType] ?? 0) + 1;
		return { integrityScore, flagCount, counts };
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
			severity:
				e.severity ?? AttemptsService.DEFAULT_SEVERITY[e.eventType] ?? "medium",
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
		const autoSubmit =
			tabSwitches >= assessment.anticheatTabSwitchLimit ||
			(assessment.anticheatFullscreenRequired && fullscreenExits >= 2);

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
				severity: AttemptsService.DEFAULT_SEVERITY[eventType] ?? "medium",
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
	private isCorrect(question: Question | undefined, answer?: string): boolean {
		if (!question || answer == null) return false;
		const given = String(answer).trim();
		const correct = (question.correctAnswer ?? "").trim();
		if (correct.length === 0) return false;
		if (question.type === "short_answer") {
			return given.toLowerCase() === correct.toLowerCase();
		}
		return given === correct;
	}

	private detectFastAnswers(
		assessment: Assessment,
		attempt: AssessmentAttempt,
		snap: AttemptSnapshot,
	) {
		const threshold = assessment.anticheatTimePerQuestionFlagSeconds ?? 2;
		if (threshold <= 0) return [] as { questionId: string; seconds: number }[];
		const sorted = Object.entries(snap.answeredAt)
			.map(([questionId, iso]) => ({ questionId, t: new Date(iso).getTime() }))
			.sort((a, b) => a.t - b.t);
		const flags: { questionId: string; seconds: number }[] = [];
		let prev = new Date(attempt.startedAt).getTime();
		for (const entry of sorted) {
			const gap = (entry.t - prev) / 1000;
			if (gap >= 0 && gap < threshold) {
				flags.push({
					questionId: entry.questionId,
					seconds: Math.round(gap * 100) / 100,
				});
			}
			prev = entry.t;
		}
		return flags;
	}

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
			const exact = this.isCorrect(q, answer);
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

		let earned = 0;
		let total = 0;
		for (const sq of snap.questions) {
			const q = byId.get(sq.id);
			const points = q?.points ?? sq.points ?? 1;
			total += points;
			if (correct.get(sq.id)) earned += points;
		}
		// Freeze the graded correctness so the review matches the score (§4.4).
		snap.correct = Object.fromEntries(correct);
		const score = total > 0 ? Math.round((earned / total) * 10_000) / 100 : 0;
		const passed = score >= Number(assessment.passMark);

		const fastFlags = this.detectFastAnswers(assessment, attempt, snap);

		const updated = await this.prisma.$transaction(async (tx) => {
			if (fastFlags.length > 0) {
				await tx.assessmentAntiCheatLog.createMany({
					data: fastFlags.map((f) => ({
						attemptId: attempt.id,
						eventType: "fast_answer" as const,
						severity: "low" as const,
						metadataJson: f,
					})),
				});
			}
			// Integrity reflects ALL flags — server fast-answer + client-ingested (§4.6.4).
			const logs = await tx.assessmentAntiCheatLog.findMany({
				where: { attemptId: attempt.id },
				select: { severity: true },
			});
			const { integrityScore, flagCount } = this.integrityFromLogs(logs);
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
				},
			});
		});

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

	private toResult(
		assessment: Assessment,
		attempt: AssessmentAttempt,
		questions: Question[],
	) {
		const snap = this.snapOf(attempt);
		const byId = new Map(questions.map((q) => [q.id, q]));
		return {
			status: "submitted" as const,
			attemptId: attempt.id,
			assessmentId: assessment.id,
			title: assessment.title,
			attemptNumber: attempt.attemptNumber,
			submittedAt: attempt.submittedAt,
			autoSubmitted: attempt.autoSubmitted,
			score: attempt.score == null ? 0 : Number(attempt.score),
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
						snap.correct?.[sq.id] ?? this.isCorrect(q, snap.answers[sq.id]),
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
