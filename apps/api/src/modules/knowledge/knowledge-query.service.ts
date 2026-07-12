import { Injectable } from "@nestjs/common";
import { KnowledgeService } from "./knowledge.service";

/**
 * Thin, module-exported query surface (§6.4 rule 1) other contexts may depend
 * on — currently the Tutor, to retrieve the passages most relevant to a
 * question instead of stuffing the whole transcript. Read-only.
 */
@Injectable()
export class KnowledgeQueryService {
	constructor(private readonly knowledge: KnowledgeService) {}

	/** Top-`k` transcript passages for a lesson relevant to `question`. */
	async retrieveLessonContext(
		lessonId: string,
		question: string,
		k = 4,
	): Promise<{ chunks: string[] }> {
		const hits = await this.knowledge.search(question, {
			lessonId,
			limit: k,
		});
		return { chunks: hits.map((h) => h.content) };
	}
}
