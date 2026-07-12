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

const SIMPLIFY_TTL_SECONDS = 24 * 60 * 60;

/** Strip Tiptap/HTML markup to readable plain text for the AI prompt. */
function htmlToText(html: string): string {
	return html
		.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
		.replace(/<\/(p|div|li|h[1-6]|br)>/gi, "\n")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&quot;/gi, '"')
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/**
 * Content Simplifier (§4.10 — "Simplify this") — rewrites a lesson's prose in
 * plainer language. Owns no tables: reads a lesson snapshot, picks the text
 * source (reading content, else transcript) and delegates to the AI port, so
 * it could be extracted with only its port changing (§6.4).
 *
 * Session-gated like media playback; hard enrolment gating lands with payments.
 */
@Injectable()
export class SimplifierService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(AI_PORT) private readonly ai: AiPort,
		@Inject(CACHE_PORT) private readonly cache: CachePort,
	) {}

	async simplify(user: AuthenticatedUser, lessonId: string) {
		const [lesson, profile] = await Promise.all([
			this.prisma.lesson.findUnique({
				where: { id: lessonId },
				select: {
					id: true,
					title: true,
					contentText: true,
					transcriptText: true,
				},
			}),
			this.prisma.user.findUnique({
				where: { id: user.id },
				select: { language: true },
			}),
		]);
		if (!lesson) throw new NotFoundException("Lesson not found");

		// Prefer the reading content; fall back to the transcript (§4.2 — every
		// lesson has one). Whichever exists is what the learner is consuming.
		const fromContent = lesson.contentText
			? htmlToText(lesson.contentText)
			: "";
		const source = fromContent || (lesson.transcriptText ?? "").trim();
		if (!source) {
			throw new UnprocessableEntityException({
				code: "SIMPLIFY_NO_CONTENT",
				message: "This lesson has no text to simplify.",
			});
		}

		const language = profile?.language ?? "en";
		// Deterministic per (lesson, language, content) — cache so a lesson is
		// only ever simplified once. The content hash auto-invalidates on edits.
		const cacheKey = `simplify:v1:${lesson.id}:${language}:${shortHash(source)}`;
		const cached = await this.cache.get<string>(cacheKey);
		if (cached != null) return { simplified: cached };

		const simplified = await this.ai.simplifyText({
			text: source,
			lessonTitle: lesson.title,
			language,
		});
		await this.cache.set(cacheKey, simplified, SIMPLIFY_TTL_SECONDS);
		return { simplified };
	}
}
