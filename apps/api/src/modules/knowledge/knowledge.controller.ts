import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { SessionGuard } from "../../auth/guards/session.guard";
import { UserThrottlerGuard } from "../../common/guards/user-throttler.guard";
import { KnowledgeService } from "./knowledge.service";
import { KnowledgeAdminService } from "./knowledge-admin.service";

/**
 * Semantic search over a course's transcripts (§4.10 RAG). Session-gated like
 * lesson playback. The admin reindex backfills legacy content.
 */
@ApiTags("knowledge")
@Controller()
export class KnowledgeController {
	constructor(
		private readonly knowledge: KnowledgeService,
		private readonly admin: KnowledgeAdminService,
	) {}

	@Get("courses/:courseId/search")
	@UseGuards(SessionGuard, UserThrottlerGuard)
	@Throttle({ default: { limit: 30, ttl: 60_000 } })
	@ApiOperation({ summary: "Semantic search over this course's lessons" })
	search(@Param("courseId") courseId: string, @Query("q") q = "") {
		return this.knowledge.searchCourse(courseId, q);
	}

	@Get("paths/:pathId/search")
	@UseGuards(SessionGuard, UserThrottlerGuard)
	@Throttle({ default: { limit: 30, ttl: 60_000 } })
	@ApiOperation({ summary: "Semantic search across this path's courses" })
	searchPath(@Param("pathId") pathId: string, @Query("q") q = "") {
		return this.knowledge.searchPath(pathId, q);
	}

	@Get("cohorts/:cohortId/search")
	@UseGuards(SessionGuard, UserThrottlerGuard)
	@Throttle({ default: { limit: 30, ttl: 60_000 } })
	@ApiOperation({ summary: "Semantic search across this cohort's courses" })
	searchCohort(@Param("cohortId") cohortId: string, @Query("q") q = "") {
		return this.knowledge.searchCohort(cohortId, q);
	}

	@Post("admin/knowledge/reindex")
	@UseGuards(SessionGuard, RolesGuard)
	@Roles("admin")
	@ApiOperation({ summary: "Re-index all lesson transcripts (backfill)" })
	reindex() {
		return this.admin.reindexAll();
	}
}
