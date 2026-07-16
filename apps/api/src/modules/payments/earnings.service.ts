import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
	calculateSaleLedger,
	type LedgerSummary,
	type SaleOutcome,
	summariseLedger,
} from "./earn-back-ledger.calculator";

/**
 * Instructor earnings read model (§8.5, §15) backing `/instructor/earnings`.
 * Read-only: it never moves money (the worker does) and everything is scoped to
 * the caller.
 *
 * TWO LEDGERS, deliberately (§4.11.5):
 *  - `summary`/`history` — the CASH ledger over `instructor_payouts`: what we
 *    actually transferred.
 *  - `ledger` — the COMMERCIAL ledger over `orders`: what happened to each sale.
 * They are not the same book. At e = 100 an on-time finish forfeits nothing, so
 * no payout row is written at all — the cash ledger is silent about a real sale.
 * Projecting orders is what lets the creator tell "nobody bought this" apart
 * from "everybody who bought it finished".
 */
export interface EarningsSummary {
	currency: string;
	lifetimeProcessed: number;
	pending: number;
	failed: number;
	processedCount: number;
	pendingCount: number;
}

export interface PayoutHistoryRow {
	id: string;
	amount: number;
	currency: string;
	status: "pending" | "processed" | "failed" | null;
	entityTitle: string | null;
	triggeredAt: string;
	processedAt: string | null;
	failedReason: string | null;
}

/** One sale in the creator's commercial ledger, in major units for display. */
export interface SaleLedgerRow {
	orderId: string;
	entityType: string | null;
	entityTitle: string | null;
	learnerName: string;
	currency: string;
	/** What the learner paid. */
	gross: number;
	/** The frozen earn-back % this sale was bought under (null when off). */
	earnBackPercentage: number | null;
	outcome: SaleOutcome;
	/** Already paid: the creator's cut of guaranteed revenue. */
	guaranteed: number;
	/** Ceiling still riding on an open escrow (0 once resolved). */
	atStake: number;
	/** Earned from the forfeited slice once resolved. */
	earnedFromEscrow: number;
	/** What this sale has actually earned the creator so far. */
	totalEarned: number;
	/** Days past the deadline, once resolved. */
	daysLate: number | null;
	/** The escrow deadline, while one is pending. */
	deadline: string | null;
	soldAt: string;
}

export interface SaleLedgerView {
	currency: string;
	summary: LedgerSummary & {
		grossMajor: number;
		earnedMajor: number;
		atStakeMajor: number;
	};
	rows: SaleLedgerRow[];
}

/** Decimal (major) → integer minor units, the calculators' contract. */
function toMinor(major: unknown): number {
	return Math.round(Number(major ?? 0) * 100);
}
/** Minor units → major for display. */
function toMajor(minor: number): number {
	return Math.round(minor) / 100;
}

@Injectable()
export class EarningsService {
	constructor(private readonly prisma: PrismaService) {}

	async summary(instructorId: string): Promise<EarningsSummary> {
		const grouped = await this.prisma.instructorPayout.groupBy({
			by: ["status"],
			where: { instructorId },
			_sum: { amount: true },
			_count: { _all: true },
		});
		const bucket = (status: string) => grouped.find((g) => g.status === status);
		const processed = bucket("processed");
		const pending = bucket("pending");
		const failed = bucket("failed");

		const currency =
			(
				await this.prisma.instructorPayout.findFirst({
					where: { instructorId },
					select: { currency: true },
					orderBy: { triggeredAt: "desc" },
				})
			)?.currency ?? "NGN";

		return {
			currency,
			lifetimeProcessed: Number(processed?._sum.amount ?? 0),
			pending: Number(pending?._sum.amount ?? 0),
			failed: Number(failed?._sum.amount ?? 0),
			processedCount: processed?._count._all ?? 0,
			pendingCount: pending?._count._all ?? 0,
		};
	}

	/**
	 * The creator's COMMERCIAL ledger (§8.5): every settled sale of their content
	 * and what became of it. Projected from the frozen Order snapshots (§4.11.2)
	 * — a later percentage/price edit can never restate historical earnings — and
	 * scoped to `instructorId`, so a creator only ever sees their own sales.
	 *
	 * Reads orders + their earn-back transactions directly: both are Payments'
	 * own tables, so this crosses no context boundary (§6.4).
	 */
	async ledger(instructorId: string, limit = 50): Promise<SaleLedgerView> {
		const orders = await this.prisma.order.findMany({
			where: {
				instructorId,
				// Pending/failed checkouts aren't sales — they'd inflate the count
				// with money that never arrived.
				status: { in: ["paid", "earn_back_issued"] },
			},
			orderBy: { createdAt: "desc" },
			take: Math.min(100, Math.max(1, limit)),
			select: {
				id: true,
				entityType: true,
				entityTitle: true,
				amount: true,
				currency: true,
				createdAt: true,
				status: true,
				isEarnBackEligible: true,
				isPlatformOwned: true,
				earnBackBase: true,
				earnBackPercentage: true,
				earnBackDeadline: true,
				instructorAmount: true,
				revenueSplitPct: true,
				user: { select: { fullName: true, firstName: true, lastName: true } },
			},
		});

		const resolutions = new Map(
			(
				await this.prisma.earnBackTransaction.findMany({
					where: { orderId: { in: orders.map((o) => o.id) } },
					orderBy: { calculatedAt: "desc" },
					select: {
						orderId: true,
						daysLate: true,
						forfeitedAmount: true,
						forfeitedInstructorCut: true,
					},
				})
			).map((t) => [t.orderId, t]),
		);

		const computed = orders.map((o) => {
			const resolution = resolutions.get(o.id);
			const result = calculateSaleLedger({
				isEarnBackEligible: o.isEarnBackEligible,
				earnBackBaseMinor: toMinor(o.earnBackBase),
				instructorAmountMinor: toMinor(o.instructorAmount),
				instructorSharePct: o.revenueSplitPct ?? 90,
				isPlatformOwned: o.isPlatformOwned,
				orderStatus: o.status,
				resolution: resolution
					? {
							daysLate: resolution.daysLate,
							forfeitedAmountMinor: toMinor(resolution.forfeitedAmount),
							forfeitedInstructorCutMinor: toMinor(
								resolution.forfeitedInstructorCut,
							),
						}
					: null,
			});
			return { order: o, resolution, result, grossMinor: toMinor(o.amount) };
		});

		const summary = summariseLedger(
			computed.map(({ grossMinor, result }) => ({ grossMinor, result })),
		);

		return {
			currency: orders[0]?.currency ?? "NGN",
			summary: {
				...summary,
				grossMajor: toMajor(summary.grossMinor),
				earnedMajor: toMajor(summary.earnedMinor),
				atStakeMajor: toMajor(summary.atStakeMinor),
			},
			rows: computed.map(({ order: o, resolution, result, grossMinor }) => ({
				orderId: o.id,
				entityType: o.entityType,
				entityTitle: o.entityTitle,
				learnerName:
					o.user?.fullName?.trim() ||
					`${o.user?.firstName ?? ""} ${o.user?.lastName ?? ""}`.trim() ||
					"Learner",
				currency: o.currency ?? "NGN",
				gross: toMajor(grossMinor),
				earnBackPercentage: o.isEarnBackEligible ? o.earnBackPercentage : null,
				outcome: result.outcome,
				guaranteed: toMajor(result.guaranteedMinor),
				atStake: toMajor(result.atStakeMinor),
				earnedFromEscrow: toMajor(result.earnedFromEscrowMinor),
				totalEarned: toMajor(result.totalEarnedMinor),
				daysLate: resolution?.daysLate ?? null,
				deadline:
					result.outcome === "at_stake"
						? (o.earnBackDeadline?.toISOString() ?? null)
						: null,
				soldAt: o.createdAt.toISOString(),
			})),
		};
	}

	async history(instructorId: string, limit = 50): Promise<PayoutHistoryRow[]> {
		const rows = await this.prisma.instructorPayout.findMany({
			where: { instructorId },
			orderBy: { triggeredAt: "desc" },
			take: Math.min(100, Math.max(1, limit)),
			include: { order: { select: { entityTitle: true } } },
		});
		return rows.map((r) => ({
			id: r.id,
			amount: Number(r.amount ?? 0),
			currency: r.currency ?? "NGN",
			status: r.status,
			entityTitle: r.order?.entityTitle ?? null,
			triggeredAt: r.triggeredAt.toISOString(),
			processedAt: r.processedAt?.toISOString() ?? null,
			failedReason: r.failedReason,
		}));
	}
}
