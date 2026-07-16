/**
 * Pure two-pool settlement math (§2 Revenue Split, §4.11.4, §14.2, §6.4 "pure
 * calculators" — no Prisma, no I/O, no gateway). Given a paid enrolment, it
 * splits the price into the two pools and computes the immediate 90/10 payout
 * on the guaranteed pool only. Everything downstream (webhook settlement,
 * earn-back forfeiture) reads these numbers off the Order snapshot — never a
 * live catalogue lookup (§4.11.2).
 *
 * MONEY IS INTEGER MINOR UNITS (kobo/cents). Decimal→minor conversion happens
 * at the service boundary; this file never touches floats, so there is no
 * rounding drift. The one division (90/10 of N) rounds the platform cut UP and
 * gives the instructor the remainder, so the two cuts always re-sum to N to the
 * exact minor unit (no lost/created money).
 *
 * Two pools per payment of price P, split by the content's earn_back_percentage
 * e (1–100), frozen at order time:
 *   - Earn-Back Base    B = e% × P   — refundable, ESCROWED (paid to no one now)
 *   - Guaranteed Revenue N = P − B   — never refundable, settled immediately
 * Earn-back OFF ⇒ B = 0, N = P (whole price is guaranteed revenue).
 *
 * The 90/10 split is the constant settlement rule; platform-owned content
 * (no instructor) settles 100% to the platform.
 */

export interface RevenueSplitInput {
	/** Price actually paid, in integer minor units (kobo/cents). */
	priceMinor: number;
	/** Earn-Back is ON for this content. When false, B = 0 and N = price. */
	isEarnBackEligible: boolean;
	/**
	 * Frozen earn-back percentage e (1–100). Only meaningful when eligible;
	 * ignored when earn-back is OFF. Defaults to 100 when eligible but unset.
	 */
	earnBackPercentage: number | null;
	/**
	 * Instructor's share of settled revenue, 0–100 (platform_settings
	 * `instructor_revenue_share_pct`, default 90). The platform keeps the rest.
	 */
	instructorSharePct: number;
	/**
	 * Platform-owned content (no instructor) keeps 100% of revenue — the
	 * instructor cut is 0 regardless of the share pct.
	 */
	isPlatformOwned: boolean;
	/**
	 * Non-refundable platform fee percentage taken off the top (§2), 0–100
	 * (platform_settings `platform_fee_pct`, default 5, clamped ≤ 30 upstream).
	 * The fee is charged on ALL paid content; earn-back + the 90/10 split then
	 * operate on the remainder R = P − F. Defaults to 0 when omitted.
	 */
	platformFeePct?: number;
}

export interface RevenueSplitResult {
	/** Platform fee F — non-refundable, settled to the platform immediately. */
	platformFeeMinor: number;
	/** Earn-Back Base B = e × (P − F) — escrowed, refundable. */
	earnBackBaseMinor: number;
	/** Guaranteed Revenue N = (P − F) − B — settled now. */
	guaranteedRevenueMinor: number;
	/** Instructor's cut of N, settled immediately via instructor_payout.queue. */
	instructorAmountMinor: number;
	/** Platform's immediate take: the fee F PLUS its cut of N (100% if platform-owned). */
	platformAmountMinor: number;
}

/**
 * Split the guaranteed pool `n` by the constant instructor share, rounding so
 * the two cuts always re-sum to `n` exactly. Platform-owned ⇒ instructor gets
 * nothing. Shared with the earn-back forfeiture distribution (§14.2) so both
 * "revenue that settles" paths round identically.
 */
export function splitRevenue(
	n: number,
	instructorSharePct: number,
	isPlatformOwned: boolean,
): { instructorAmountMinor: number; platformAmountMinor: number } {
	if (n <= 0 || isPlatformOwned) {
		return { instructorAmountMinor: 0, platformAmountMinor: Math.max(0, n) };
	}
	// Round the instructor cut DOWN, platform takes the remainder — the platform
	// never over-pays the instructor a fractional unit, and cuts re-sum to n.
	const instructorAmountMinor = Math.floor((n * instructorSharePct) / 100);
	return {
		instructorAmountMinor,
		platformAmountMinor: n - instructorAmountMinor,
	};
}

export function calculateRevenueSplit(
	input: RevenueSplitInput,
): RevenueSplitResult {
	const price = Math.max(0, Math.round(input.priceMinor));

	// Platform fee off the top (§2). Rounds to nearest minor unit; the remainder
	// R = P − F is exact, so conservation (P = F + N + B) always holds.
	const f = Math.min(100, Math.max(0, input.platformFeePct ?? 0));
	const platformFeeMinor = Math.round((price * f) / 100);
	const remainder = price - platformFeeMinor;

	const rawPct = input.earnBackPercentage ?? 100;
	const e =
		input.isEarnBackEligible && remainder > 0
			? Math.min(100, Math.max(0, rawPct))
			: 0;

	// Base rounds DOWN so guaranteed revenue (settled money) is never inflated
	// beyond what escrow actually holds back. Computed on the POST-FEE remainder.
	const earnBackBaseMinor = Math.floor((remainder * e) / 100);
	const guaranteedRevenueMinor = remainder - earnBackBaseMinor;

	const split = splitRevenue(
		guaranteedRevenueMinor,
		input.instructorSharePct,
		input.isPlatformOwned,
	);

	return {
		platformFeeMinor,
		earnBackBaseMinor,
		guaranteedRevenueMinor,
		instructorAmountMinor: split.instructorAmountMinor,
		// The platform keeps the fee AND its cut of the settled revenue.
		platformAmountMinor: platformFeeMinor + split.platformAmountMinor,
	};
}
