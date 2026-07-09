import { Sparkles, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * Growth-framed score line (§3.1 Dweck): always leads with progress, never
 * with a raw grade. Priority — pre→post growth on the same lesson, then
 * improvement over the previous best, then "new baseline" on a first
 * attempt, then a steady retrieval-practice line. Never negative.
 */
export function GrowthLine({
	score,
	previousBest,
	delta,
	preQuizBest,
	className,
}: {
	score: number;
	previousBest: number | null;
	delta: number | null;
	/** Best pre-quiz score for the SAME lesson, when rendering a post-quiz. */
	preQuizBest?: number | null;
	className?: string;
}) {
	const { t } = useTranslation("engagement");

	let line: string;
	let grew = true;
	if (preQuizBest != null && score > preQuizBest) {
		line = t("growth.pre_post", { pre: preQuizBest, post: score });
	} else if (delta != null && delta > 0) {
		line = t("growth.grew", { delta });
	} else if (previousBest == null) {
		line = t("growth.baseline", { score });
	} else {
		grew = false;
		line = t("growth.steady", { best: Math.max(previousBest, score) });
	}
	const Icon = grew ? TrendingUp : Sparkles;

	return (
		<p
			data-testid="growth-line"
			className={cn(
				"flex items-center justify-center gap-2 font-medium text-emerald-700 dark:text-emerald-400",
				className,
			)}
		>
			<Icon aria-hidden className="size-4 shrink-0" />
			{line}
		</p>
	);
}
