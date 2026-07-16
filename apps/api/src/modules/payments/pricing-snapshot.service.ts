import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformSettingsService } from "../../shared/settings/platform-settings.service";
import type { EnrollableType } from "../enrollment/enrollment.service";

/**
 * Builds the order-time pricing snapshot (§4.11.2) — the ONE place the Payments
 * context reads the live catalogue. Everything downstream (settlement,
 * earn-back) reads the frozen copy on the Order, never here, so later price /
 * percentage edits can't corrupt in-flight enrolments and the earn-back engine
 * stays decoupled from the Catalogue (§6.4).
 *
 * Ownership rules (§2): a course/path settles to its creator (the instructor);
 * platform-owned when it has no creator or an Admin created it. A cohort's
 * revenue always goes to the platform (instructor facilitation fees are manual,
 * outside this system), so cohorts are always platform-owned with no payout.
 */
export interface PricingSnapshot {
	entityType: EnrollableType;
	entityId: string;
	title: string;
	/** Price P in integer minor units (kobo/cents). */
	priceMinor: number;
	currency: string;
	isEarnBackEligible: boolean;
	/** Frozen e (1–100) — null when earn-back is off. */
	earnBackPercentage: number | null;
	/**
	 * The creator's deadline policy, clamped to the guardrail — or **null when
	 * the creator left it open**, which is the signal that the learner picks
	 * their own (§4.11.1). Collapsing null to the max here would silently decide
	 * on the learner's behalf and erase the distinction forever.
	 */
	earnBackDeadlineDays: number | null;
	/**
	 * The platform's window ceiling, frozen at order time like every other term
	 * (§4.11.2). It bounds the learner's choice, so a later Admin change can't
	 * move the goalposts on an in-flight enrolment.
	 */
	earnBackMaxDays: number;
	/** Whose account settles the guaranteed revenue; null when platform-owned. */
	instructorId: string | null;
	isPlatformOwned: boolean;
	/** Instructor revenue share frozen at order time (default 90). */
	revenueSplitPct: number;
	/** Non-refundable platform fee % frozen at order time (§2, default 5). */
	platformFeePct: number;
}

function toMinor(price: { toString(): string }): number {
	return Math.round(Number(price.toString()) * 100);
}

@Injectable()
export class PricingSnapshotService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly settings: PlatformSettingsService,
	) {}

	/**
	 * Returns the snapshot for a purchasable, published paid entity, or null when
	 * it is free, unpublished, or missing (callers treat null as "no checkout").
	 */
	async build(
		type: EnrollableType,
		id: string,
	): Promise<PricingSnapshot | null> {
		const [maxDays, sharePct, feePct] = await Promise.all([
			this.settings.earnBackMaxDurationDays(),
			this.settings.instructorRevenueSharePct(),
			this.settings.platformFeePct(),
		]);
		// null in ⇒ null out: "the creator left it open" is a real state that the
		// learner resolves (§4.11.1), not a missing value to paper over.
		const clampDeadline = (days: number | null | undefined): number | null =>
			days == null ? null : Math.min(maxDays, Math.max(1, days));

		if (type === "course") {
			const c = await this.prisma.course.findUnique({
				where: { id },
				select: {
					title: true,
					price: true,
					currency: true,
					isFree: true,
					status: true,
					isEarnBackEligible: true,
					earnBackPercentage: true,
					earnBackDeadlineDays: true,
					createdBy: true,
					creator: { select: { role: true } },
				},
			});
			if (c?.status !== "published" || c.isFree) return null;
			const platformOwned = !c.createdBy || c.creator?.role === "admin";
			return {
				entityType: "course",
				entityId: id,
				title: c.title,
				priceMinor: toMinor(c.price),
				currency: c.currency,
				isEarnBackEligible: c.isEarnBackEligible,
				earnBackPercentage: c.isEarnBackEligible
					? (c.earnBackPercentage ?? 100)
					: null,
				earnBackDeadlineDays: clampDeadline(c.earnBackDeadlineDays),
				earnBackMaxDays: maxDays,
				instructorId: platformOwned ? null : c.createdBy,
				isPlatformOwned: platformOwned,
				revenueSplitPct: sharePct,
				platformFeePct: feePct,
			};
		}

		if (type === "path") {
			const p = await this.prisma.learningPath.findUnique({
				where: { id },
				select: {
					title: true,
					price: true,
					currency: true,
					isFree: true,
					status: true,
					isEarnBackEligible: true,
					earnBackPercentage: true,
					earnBackDeadlineDays: true,
					createdBy: true,
					creator: { select: { role: true } },
				},
			});
			if (p?.status !== "published" || p.isFree) return null;
			const platformOwned = !p.createdBy || p.creator?.role === "admin";
			return {
				entityType: "path",
				entityId: id,
				title: p.title,
				priceMinor: toMinor(p.price),
				currency: p.currency,
				isEarnBackEligible: p.isEarnBackEligible,
				earnBackPercentage: p.isEarnBackEligible
					? (p.earnBackPercentage ?? 100)
					: null,
				earnBackDeadlineDays: clampDeadline(p.earnBackDeadlineDays),
				earnBackMaxDays: maxDays,
				instructorId: platformOwned ? null : p.createdBy,
				isPlatformOwned: platformOwned,
				revenueSplitPct: sharePct,
				platformFeePct: feePct,
			};
		}

		const co = await this.prisma.cohort.findUnique({
			where: { id },
			select: {
				title: true,
				price: true,
				currency: true,
				isFree: true,
				status: true,
				isEarnBackEligible: true,
				earnBackPercentage: true,
				earnBackDeadlineDays: true,
			},
		});
		if (co?.status !== "open" || co.isFree) return null;
		// Cohort revenue is always the platform's — no auto instructor payout.
		return {
			entityType: "cohort",
			entityId: id,
			title: co.title,
			priceMinor: toMinor(co.price),
			currency: co.currency,
			isEarnBackEligible: co.isEarnBackEligible,
			earnBackPercentage: co.isEarnBackEligible
				? (co.earnBackPercentage ?? 100)
				: null,
			// Never null for a cohort (§4.11.1): a cohort is a scheduled programme,
			// so its window is the Admin's call — the learner never sets one. Blank
			// falls back to the platform max rather than becoming `provisional`,
			// which is the "learner decides" signal everywhere else.
			earnBackDeadlineDays: clampDeadline(co.earnBackDeadlineDays) ?? maxDays,
			earnBackMaxDays: maxDays,
			instructorId: null,
			isPlatformOwned: true,
			revenueSplitPct: sharePct,
			platformFeePct: feePct,
		};
	}
}
