import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/** The public shape of an academy (tenant) — what the web renders. */
export interface AcademySummary {
	id: string;
	slug: string;
	name: string;
	/** Free-form theming (colours, tagline, hero copy) — academy-defined. */
	branding: Record<string, unknown> | null;
}

/** The MVP / fallback academy (blueprint §2.4 — Teacher Academy launched first). */
export const DEFAULT_ACADEMY_SLUG = "teachers";

/**
 * Tenant (academy) bounded context — the ONLY place that reads the `tenants`
 * table (§6.4: other contexts ask this service, they never query tenants
 * directly). Resolution is the hot path (every scoped catalogue call resolves a
 * slug → id), so the tiny, near-static academy set is cached in-process with a
 * short TTL — zero Redis, which keeps it inside the free-tier budget.
 *
 * Litmus test (§6.4): this could be lifted into its own service unchanged — it
 * exposes only `resolveId`, `getBySlug`, `list`, `defaultTenantId`.
 */
@Injectable()
export class TenantService {
	private cache: { at: number; bySlug: Map<string, AcademySummary> } | null =
		null;
	private static readonly TTL_MS = 60_000;

	constructor(private readonly prisma: PrismaService) {}

	private async load(): Promise<Map<string, AcademySummary>> {
		if (this.cache && Date.now() - this.cache.at < TenantService.TTL_MS) {
			return this.cache.bySlug;
		}
		const rows = await this.prisma.tenant.findMany({
			select: { id: true, slug: true, name: true, brandingJson: true },
			orderBy: { createdAt: "asc" },
		});
		const bySlug = new Map<string, AcademySummary>(
			rows.map((r) => [
				r.slug,
				{
					id: r.id,
					slug: r.slug,
					name: r.name,
					branding: (r.brandingJson as Record<string, unknown> | null) ?? null,
				},
			]),
		);
		this.cache = { at: Date.now(), bySlug };
		return bySlug;
	}

	/** Slug → tenant id, or null if there is no such academy. */
	async resolveId(slug: string): Promise<string | null> {
		return (await this.load()).get(slug)?.id ?? null;
	}

	/** Full academy summary, or null if unknown. */
	async getBySlug(slug: string): Promise<AcademySummary | null> {
		return (await this.load()).get(slug) ?? null;
	}

	/** Every academy, in creation order (for the academy switcher / nav). */
	async list(): Promise<AcademySummary[]> {
		return [...(await this.load()).values()];
	}

	/**
	 * The tenant new content falls back to when no academy is chosen — the Teacher
	 * Academy (MVP). Nothing is ever left orphaned (null-tenant), which would make
	 * it invisible to every academy-scoped browse.
	 */
	async defaultTenantId(): Promise<string | null> {
		return this.resolveId(DEFAULT_ACADEMY_SLUG);
	}

	/**
	 * The academy a newly-authored course/path/cohort belongs to: the explicitly
	 * chosen `academy` slug when given (an unknown slug is a 404, never a silent
	 * mis-file), else the creator's own academy, else the default. Assessments and
	 * projects don't call this — they inherit their parent's academy directly.
	 */
	async resolveForAuthoring(
		academy: string | undefined,
		userTenantId: string | null | undefined,
	): Promise<string | null> {
		if (academy) {
			const id = await this.resolveId(academy);
			if (!id) {
				throw new NotFoundException({
					message: "Academy not found",
					code: "ACADEMY_NOT_FOUND",
				});
			}
			return id;
		}
		return userTenantId ?? (await this.defaultTenantId());
	}

	/** Drop the cache (call after seeding/creating an academy in the same process). */
	invalidate(): void {
		this.cache = null;
	}
}
