import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LearnerRisk, RiskReason } from "@/lib/risk";
import { cn } from "@/lib/utils";

/**
 * Drop-off risk pill (§4.10) for a learner in a staff roster. Colour by level
 * (high = destructive, medium = warning); the reasons ride along as a tooltip.
 */
export function RiskBadge({ risk }: { risk: LearnerRisk }) {
	const { t } = useTranslation("authoring");
	const high = risk.level === "high";
	const reasonText = risk.reasons
		.map((r) => reasonLabel(t, r, risk.daysInactive))
		.join(" · ");

	return (
		<span
			title={reasonText}
			className={cn(
				"inline-flex items-center gap-1 rounded-pill px-2 py-0.5 font-medium text-xs",
				high
					? "bg-destructive/10 text-destructive"
					: "bg-warning/15 text-amber-700 dark:text-amber-400",
			)}
		>
			<AlertTriangle className="size-3" />
			{t("dropoff.inactive_days", {
				count: risk.daysInactive,
				defaultValue: "Inactive {{count}}d",
			})}
		</span>
	);
}

/** At-a-glance count of at-risk learners in a cohort (list cards). Null at 0. */
export function AtRiskPill({ count }: { count: number }) {
	const { t } = useTranslation("authoring");
	if (count <= 0) return null;
	return (
		<span className="inline-flex items-center gap-1 rounded-pill bg-warning/15 px-2 py-0.5 font-medium text-amber-700 text-xs dark:text-amber-400">
			<AlertTriangle className="size-3" />
			{t("dropoff.at_risk_count", {
				count,
				defaultValue: "{{count}} at risk",
			})}
		</span>
	);
}

function reasonLabel(
	t: ReturnType<typeof useTranslation>["t"],
	reason: RiskReason,
	days: number,
): string {
	switch (reason) {
		case "never_started":
			return t("dropoff.reason_never_started", {
				defaultValue: "Hasn't started",
			});
		case "inactive_7d":
		case "inactive_14d":
			return t("dropoff.reason_inactive", {
				count: days,
				defaultValue: "Inactive {{count}} days",
			});
		case "no_recent_progress":
			return t("dropoff.reason_no_recent_progress", {
				defaultValue: "No recent progress",
			});
	}
}
