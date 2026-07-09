import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { badgeMetaOf } from "@/components/engagement/badge-meta";
import type { NextBadge } from "@/lib/engagement-api";
import { cn } from "@/lib/utils";

/** Which counting line a badge key uses — mirrors the API's BADGE_TARGETS. */
function metricOf(key: string): "lessons" | "courses" | "quizzes" | "streak" {
	if (key.startsWith("streak")) return "streak";
	if (key.startsWith("first_course") || key.startsWith("courses"))
		return "courses";
	if (key.startsWith("first_quiz") || key.startsWith("quizzes"))
		return "quizzes";
	return "lessons";
}

/**
 * §3.2 goal gradient (Kivetz's endowed progress): a compact "N more lessons
 * unlock <badge>" card with a mini progress bar — the nearest locked award
 * is always visible as the next concrete goal. Links into the awards grid.
 */
export function NextBadgeNudge({
	nextBadge,
	className,
}: {
	nextBadge: NextBadge | null;
	className?: string;
}) {
	const { t } = useTranslation("engagement");
	if (!nextBadge) return null;

	const { icon: Icon, tint } = badgeMetaOf(nextBadge.key);
	const metric = metricOf(nextBadge.key);
	const remaining = nextBadge.target - nextBadge.current;
	const pct = Math.round((nextBadge.current / nextBadge.target) * 100);

	return (
		<Link
			to="/leaderboard"
			data-testid="next-badge-nudge"
			className={cn(
				"group flex items-center gap-3 rounded-card border border-border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover",
				className,
			)}
		>
			<span
				className={cn(
					"flex size-11 shrink-0 items-center justify-center rounded-full text-white",
					tint,
				)}
			>
				<Icon className="size-5" />
			</span>
			<span className="min-w-0 flex-1">
				<span className="block font-stats font-semibold text-muted-foreground text-xs uppercase tracking-wide">
					{t("next_badge.eyebrow")}
				</span>
				<span className="mt-0.5 block truncate font-medium text-foreground text-sm">
					{t(`next_badge.${metric}`, {
						count: remaining,
						name: t(`badges.${nextBadge.key}.name`),
					})}
				</span>
				<span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
					<span
						className="block h-full rounded-full bg-brand-primary transition-all"
						style={{ width: `${pct}%` }}
					/>
				</span>
			</span>
			<ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
		</Link>
	);
}
