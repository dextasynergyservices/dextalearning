import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { KnowledgeService } from "./knowledge.service";

/**
 * One-off backfill: index every lesson that already has a transcript (for
 * content authored before RAG existed). This is the ONLY place the knowledge
 * context reads content tables directly — a maintenance path, kept out of the
 * event-driven core (§6.4). Admin-only.
 */
@Injectable()
export class KnowledgeAdminService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly knowledge: KnowledgeService,
	) {}

	async reindexAll(): Promise<{ lessons: number; chunks: number }> {
		const lessons = await this.prisma.lesson.findMany({
			where: { transcriptText: { not: null } },
			select: {
				id: true,
				title: true,
				transcriptText: true,
				module: { select: { courseId: true } },
			},
		});

		let chunks = 0;
		let indexed = 0;
		for (const lesson of lessons) {
			const text = (lesson.transcriptText ?? "").trim();
			if (!text) continue;
			const res = await this.knowledge.indexLesson({
				lessonId: lesson.id,
				lessonTitle: lesson.title,
				courseId: lesson.module?.courseId ?? null,
				transcriptText: text,
			});
			chunks += res.chunks;
			indexed += 1;
		}
		return { lessons: indexed, chunks };
	}
}
