import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Platform earnings read model (§2, §14.2, §15) backing `/admin/earnings`.
 * A thin reporting projection over settled `orders`: what the platform took —
 * the non-refundable fee (§2) plus its cut of guaranteed revenue — against what
 * learners paid and instructors earned, with a per-entity breakdown.
 *
 * Read-only and settled-only: an order counts once it is `paid` or
 * `earn_back_issued`. Every figure comes from the order's own frozen snapshot
 * columns, never re-derived from today's settings (§6.4 rule 5) — so historic
 * rows keep the terms they were actually sold under.
 */

/** An order is settled once the money has actually moved. */
const SETTLED = ["paid", "earn_back_issued"] as const;

export interface PlatformEarningsSummary {
	currency: string;
	/** What learners paid, all in. */
	grossVolume: number;
	/** Non-refundable platform fee taken off the top (§2). */
	platformFee: number;
	/** The platform's total take: the fee + its cut of guaranteed revenue. */
	platformTake: number;
	/** Credited to instructors. */
	instructorEarnings: number;
	/** Still escrowed against Earn-Back, or already refunded out. */
	earnBackEscrowed: number;
	earnBackRefunded: number;
	orderCount: number;
}

export interface PlatformEarningsRow {
	entityType: string | null;
	entityId: string | null;
	entityTitle: string | null;
	currency: string;
	orderCount: number;
	grossVolume: number;
	platformFee: number;
	platformTake: number;
	instructorEarnings: number;
}

@Injectable()
export class AdminEarningsService {
	constructor(private readonly prisma: PrismaService) {}

	async summary(): Promise<PlatformEarningsSummary> {
		const [totals, refunded, latest] = await Promise.all([
			this.prisma.order.aggregate({
				where: { status: { in: [...SETTLED] } },
				_sum: {
					amount: true,
					platformFee: true,
					platformAmount: true,
					instructorAmount: true,
					earnBackBase: true,
				},
				_count: { _all: true },
			}),
			// Earn-Back that has already gone back to learners.
			this.prisma.order.aggregate({
				where: { status: "earn_back_issued" },
				_sum: { earnBackBase: true },
			}),
			this.prisma.order.findFirst({
				where: { status: { in: [...SETTLED] } },
				select: { currency: true },
				orderBy: { paidAt: "desc" },
			}),
		]);

		const escrowedTotal = Number(totals._sum.earnBackBase ?? 0);
		const refundedTotal = Number(refunded._sum.earnBackBase ?? 0);

		return {
			currency: latest?.currency ?? "NGN",
			grossVolume: Number(totals._sum.amount ?? 0),
			platformFee: Number(totals._sum.platformFee ?? 0),
			platformTake: Number(totals._sum.platformAmount ?? 0),
			instructorEarnings: Number(totals._sum.instructorAmount ?? 0),
			// Still held = every escrowed base minus the part already refunded.
			earnBackEscrowed: escrowedTotal - refundedTotal,
			earnBackRefunded: refundedTotal,
			orderCount: totals._count._all,
		};
	}

	/** Per-entity breakdown, biggest earner first. */
	async byEntity(limit = 50): Promise<PlatformEarningsRow[]> {
		const grouped = await this.prisma.order.groupBy({
			by: ["entityType", "entityId", "entityTitle", "currency"],
			where: { status: { in: [...SETTLED] } },
			_sum: {
				amount: true,
				platformFee: true,
				platformAmount: true,
				instructorAmount: true,
			},
			_count: { _all: true },
			orderBy: { _sum: { amount: "desc" } },
			take: Math.min(200, Math.max(1, limit)),
		});
		return grouped.map((g) => ({
			entityType: g.entityType,
			entityId: g.entityId,
			entityTitle: g.entityTitle,
			currency: g.currency ?? "NGN",
			orderCount: g._count._all,
			grossVolume: Number(g._sum.amount ?? 0),
			platformFee: Number(g._sum.platformFee ?? 0),
			platformTake: Number(g._sum.platformAmount ?? 0),
			instructorEarnings: Number(g._sum.instructorAmount ?? 0),
		}));
	}
}
