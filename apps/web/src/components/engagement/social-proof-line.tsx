import { Sparkles, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * Social-proof counters (§3.2 "47 teachers completed this module this
 * week"). Renders nothing at zero — empty proof is worse than none.
 */
export function SocialProofLine({
	enrolled,
	completedThisWeek,
	className,
}: {
	enrolled?: number | null;
	completedThisWeek?: number | null;
	className?: string;
}) {
	const { t } = useTranslation("engagement");
	const showEnrolled = (enrolled ?? 0) > 0;
	const showCompleted = (completedThisWeek ?? 0) > 0;
	if (!showEnrolled && !showCompleted) return null;

	return (
		<p
			data-testid="social-proof"
			className={cn(
				"flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs",
				className,
			)}
		>
			{showEnrolled ? (
				<span className="inline-flex items-center gap-1">
					<Users aria-hidden className="size-3.5" />
					{t("social.enrolled", { n: enrolled ?? 0 })}
				</span>
			) : null}
			{showCompleted ? (
				<span className="inline-flex items-center gap-1">
					<Sparkles aria-hidden className="size-3.5" />
					{t("social.completed_week", { n: completedThisWeek ?? 0 })}
				</span>
			) : null}
		</p>
	);
}
