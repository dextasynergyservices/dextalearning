/**
 * Pure pricing + Earn-Back normalization (§4.1, §4.11, §6.4 "pure calculators"
 * — no Prisma, no I/O). Shared by courses/paths/cohorts, which were carrying
 * three copies of this exact logic before extraction.
 *
 * Rules:
 * - A free item carries no price or Earn-Back, full stop — `isFree: true`
 *   force-clears price/eligibility/percentage regardless of what else was sent.
 * - Enabling Earn-Back defaults the percentage to 100 (of price) unless a
 *   specific value was given; disabling it clears the percentage.
 * - Only fields the caller actually supplied are written (so a partial
 *   settings-panel save never clobbers unrelated fields to `undefined`).
 *
 * NOTE: this is the eligibility/percentage *normalization* only — the actual
 * 90/10 escrow split + payout calculation is deferred to the payments phase
 * and does not exist in the codebase yet.
 */

export interface CommercialInput {
	price?: number;
	isFree?: boolean;
	currency?: string;
	isEarnBackEligible?: boolean;
	earnBackPercentage?: number;
	/**
	 * The creator's Earn-Back window. Courses/paths may leave it blank, which
	 * hands the choice to the learner (§4.11.1); a **cohort** blank instead falls
	 * back to the platform max, because a cohort is a scheduled programme and its
	 * window is always the Admin's call. That distinction lives in the pricing
	 * snapshot — this normalizer just stores what was set.
	 */
	earnBackDeadlineDays?: number;
}

export function normalizeCommercials(
	dto: CommercialInput,
): Record<string, unknown> {
	const data: Record<string, unknown> = {};
	if (dto.currency !== undefined) data.currency = dto.currency;
	if (dto.earnBackDeadlineDays !== undefined) {
		data.earnBackDeadlineDays = dto.earnBackDeadlineDays;
	}

	if (dto.isFree === true) {
		data.isFree = true;
		data.price = 0;
		data.isEarnBackEligible = false;
		data.earnBackPercentage = null;
		return data;
	}
	if (dto.isFree === false) data.isFree = false;
	if (dto.price !== undefined) data.price = dto.price;

	if (dto.isEarnBackEligible === true) {
		data.isEarnBackEligible = true;
		data.earnBackPercentage = dto.earnBackPercentage ?? 100;
	} else if (dto.isEarnBackEligible === false) {
		data.isEarnBackEligible = false;
		data.earnBackPercentage = null;
	} else if (dto.earnBackPercentage !== undefined) {
		data.earnBackPercentage = dto.earnBackPercentage;
	}
	return data;
}
