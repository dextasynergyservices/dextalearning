/**
 * Drop-off risk model (§4.10). A pure, explainable heuristic — framework-free
 * (§6.4 rule 4) — that scores a cohort learner's disengagement from inactivity
 * signals. Deterministic and cheap, so it runs over every learner daily without
 * an AI call. Reason codes are localized client-side.
 */
export type RiskLevel = "low" | "medium" | "high";

export type RiskReason =
	| "never_started"
	| "inactive_7d"
	| "inactive_14d"
	| "no_recent_progress";

export interface RiskInput {
	/** Days since the learner's last learning action, or null if never active. */
	daysSinceActive: number | null;
	/** Days since the learner enrolled in the cohort. */
	daysSinceEnrolled: number;
	/** Completed learners are never at risk. */
	isComplete: boolean;
	/** Learning actions in the last 14 days (progress stall signal). */
	recentActions: number;
}

export interface RiskResult {
	level: RiskLevel;
	/** Higher = more at risk; drives sort order. */
	score: number;
	reasons: RiskReason[];
	/** Days counted as "inactive" for display (since active, else since enrolled). */
	daysInactive: number;
}

/** Grace window before a brand-new, not-yet-started enrollment is flagged. */
const NEVER_STARTED_GRACE_DAYS = 3;

export function computeRisk(input: RiskInput): RiskResult {
	const daysInactive = input.daysSinceActive ?? input.daysSinceEnrolled;

	if (input.isComplete) {
		return { level: "low", score: 0, reasons: [], daysInactive };
	}

	const reasons: RiskReason[] = [];
	let level: RiskLevel = "low";

	if (input.daysSinceActive === null) {
		// Enrolled but never took a single action.
		if (input.daysSinceEnrolled >= 7) {
			level = "high";
			reasons.push("never_started");
		} else if (input.daysSinceEnrolled >= NEVER_STARTED_GRACE_DAYS) {
			level = "medium";
			reasons.push("never_started");
		}
	} else if (input.daysSinceActive >= 14) {
		level = "high";
		reasons.push("inactive_14d");
	} else if (input.daysSinceActive >= 7) {
		level = "medium";
		reasons.push("inactive_7d");
	}

	// Was active recently by the clock but has done nothing in two weeks —
	// a softer stall signal that nudges an otherwise-low learner to medium.
	if (
		level === "low" &&
		input.daysSinceActive !== null &&
		input.recentActions === 0 &&
		input.daysSinceActive >= 4
	) {
		level = "medium";
		reasons.push("no_recent_progress");
	}

	// Score: primary by level band, tie-broken by how long they've been idle.
	const band = level === "high" ? 200 : level === "medium" ? 100 : 0;
	return {
		level,
		score: band + Math.min(daysInactive, 99),
		reasons,
		daysInactive,
	};
}
