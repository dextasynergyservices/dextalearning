import {
	Inject,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";
import { AI_PORT, type AiPort } from "../../shared/ai/ai.port";
import { shortHash } from "../../shared/ai/hash.util";
import { CACHE_PORT, type CachePort } from "../../shared/cache/cache.port";
import { KnowledgeQueryService } from "../knowledge/knowledge-query.service";
import type { AskTutorDto } from "./dto/ask-tutor.dto";

const TUTOR_TTL_SECONDS = 6 * 60 * 60;

/**
 * AI Lesson Tutor (§4.10) — answers a learner's question about a single lesson,
 * grounded strictly in the instructor-uploaded transcript. Owns no tables: it
 * reads a lesson snapshot and delegates to the AI port (§6.4 — swap the model
 * by swapping the adapter; this context is unaffected).
 *
 * Access mirrors the media-token seam: a session is required; hard enrolment
 * gating lands with payments (Phase 7), consistent with playback today.
 */
@Injectable()
export class TutorService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(AI_PORT) private readonly ai: AiPort,
		private readonly knowledge: KnowledgeQueryService,
		@Inject(CACHE_PORT) private readonly cache: CachePort,
	) {}

	async ask(user: AuthenticatedUser, lessonId: string, dto: AskTutorDto) {
		const [lesson, profile] = await Promise.all([
			this.prisma.lesson.findUnique({
				where: { id: lessonId },
				select: { id: true, title: true, transcriptText: true },
			}),
			this.prisma.user.findUnique({
				where: { id: user.id },
				select: { language: true },
			}),
		]);
		if (!lesson) throw new NotFoundException("Lesson not found");

		const transcript = (lesson.transcriptText ?? "").trim();
		if (!transcript) {
			// Nothing to ground answers in — the UI hides the tutor here, but guard
			// the endpoint too so we never hallucinate without a source.
			throw new UnprocessableEntityException({
				code: "TUTOR_NO_TRANSCRIPT",
				message: "This lesson has no transcript to tutor from yet.",
			});
		}

		const language = profile?.language ?? "en";
		// Cache only opening questions (no history) — they repeat across learners;
		// follow-ups are conversation-specific. Transcript hash auto-invalidates.
		const firstTurn = !dto.history || dto.history.length === 0;
		const cacheKey = firstTurn
			? `tutor:v1:${lesson.id}:${language}:${shortHash(dto.question)}:${shortHash(transcript)}`
			: null;
		if (cacheKey) {
			const cached = await this.cache.get<{
				answer: string;
				grounded: boolean;
			}>(cacheKey);
			if (cached) return cached;
		}

		// RAG (§4.10): ground on the passages most relevant to the question when
		// the lesson is indexed; fall back to the full transcript otherwise (not
		// yet indexed, or index empty). Either way the source is this lesson only.
		const context = await this.buildContext(lessonId, dto.question, transcript);

		const { answer, grounded } = await this.ai.answerLessonQuestion({
			lessonTitle: lesson.title,
			transcript: context,
			question: dto.question,
			history: dto.history,
			language,
		});
		if (cacheKey)
			await this.cache.set(cacheKey, { answer, grounded }, TUTOR_TTL_SECONDS);
		return { answer, grounded };
	}

	/**
	 * Streaming counterpart of {@link ask}: yields answer text deltas. Access +
	 * transcript checks run before the first yield, so the controller can turn a
	 * failure into a proper HTTP status. Not cached (streams are transient).
	 */
	async *askStream(
		user: AuthenticatedUser,
		lessonId: string,
		dto: AskTutorDto,
	): AsyncGenerator<string> {
		const [lesson, profile] = await Promise.all([
			this.prisma.lesson.findUnique({
				where: { id: lessonId },
				select: { id: true, title: true, transcriptText: true },
			}),
			this.prisma.user.findUnique({
				where: { id: user.id },
				select: { language: true },
			}),
		]);
		if (!lesson) throw new NotFoundException("Lesson not found");
		const transcript = (lesson.transcriptText ?? "").trim();
		if (!transcript) {
			throw new UnprocessableEntityException({
				code: "TUTOR_NO_TRANSCRIPT",
				message: "This lesson has no transcript to tutor from yet.",
			});
		}
		const context = await this.buildContext(lessonId, dto.question, transcript);
		yield* this.ai.answerLessonQuestionStream({
			lessonTitle: lesson.title,
			transcript: context,
			question: dto.question,
			history: dto.history,
			language: profile?.language ?? "en",
		});
	}

	private async buildContext(
		lessonId: string,
		question: string,
		fullTranscript: string,
	): Promise<string> {
		try {
			const { chunks } = await this.knowledge.retrieveLessonContext(
				lessonId,
				question,
			);
			if (chunks.length > 0) return chunks.join("\n\n");
		} catch {
			// Retrieval is an optimisation — never fail the tutor over it.
		}
		return fullTranscript;
	}
}
