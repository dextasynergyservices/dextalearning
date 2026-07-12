// Drop-off risk types (§4.10), mirrored from the DropoffQueryService. Flags are
// computed by the daily sweep and surfaced read-only in the instructor +
// facilitator views. Reason codes are localized client-side.

export type RiskLevel = "medium" | "high";

export type RiskReason =
	| "never_started"
	| "inactive_7d"
	| "inactive_14d"
	| "no_recent_progress";

export interface LearnerRisk {
	level: RiskLevel;
	reasons: RiskReason[];
	daysInactive: number;
}
