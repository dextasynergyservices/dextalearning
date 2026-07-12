import { Module, type OnModuleInit } from "@nestjs/common";
import { EmbeddingStore } from "./embedding.store";
import { KnowledgeController } from "./knowledge.controller";
import { KnowledgeEventsHandler } from "./knowledge.events-handler";
import { KnowledgeService } from "./knowledge.service";
import { KnowledgeAdminService } from "./knowledge-admin.service";
import { KnowledgeQueryService } from "./knowledge-query.service";

/**
 * Knowledge / RAG bounded context (§4.10, §7). Owns `content_embeddings` and
 * provisions it on boot (pgvector can't be modelled in Prisma). Exports the
 * thin `KnowledgeQueryService` for the Tutor to retrieve relevant passages.
 */
@Module({
	controllers: [KnowledgeController],
	providers: [
		EmbeddingStore,
		KnowledgeService,
		KnowledgeQueryService,
		KnowledgeAdminService,
		KnowledgeEventsHandler,
	],
	exports: [KnowledgeQueryService],
})
export class KnowledgeModule implements OnModuleInit {
	constructor(private readonly store: EmbeddingStore) {}

	async onModuleInit(): Promise<void> {
		// Idempotent: creates the extension/table/indexes on first boot.
		await this.store.ensureSchema();
	}
}
