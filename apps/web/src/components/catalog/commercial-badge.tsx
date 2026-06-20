import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface CommercialBadgeProps {
	isFree: boolean;
	isEarnBackEligible: boolean;
	earnBackPercentage: number | null;
	className?: string;
}

/**
 * The pill shown on course/path/cohort cards + detail pages (§4.11.2):
 * `{n}% Earn-Back` (or `Earn-Back` at 100%) for Earn-Back content, otherwise a
 * `Free` pill for free content, and nothing for paid-without-Earn-Back (the
 * price carries that case).
 */
export function CommercialBadge({
	isFree,
	isEarnBackEligible,
	earnBackPercentage,
	className,
}: CommercialBadgeProps) {
	const { t } = useTranslation("academy");
	if (isEarnBackEligible) {
		return (
			<span className={cn("badge-earnback", className)}>
				{earnBackPercentage && earnBackPercentage < 100
					? t("catalog.earnback_pct", { pct: earnBackPercentage })
					: t("catalog.earnback")}
			</span>
		);
	}
	if (isFree) {
		return (
			<span className={cn("badge-free", className)}>{t("catalog.free")}</span>
		);
	}
	return null;
}
