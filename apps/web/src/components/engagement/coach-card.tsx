import { useQuery } from "@tanstack/react-query";
import { Sprout, Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { coachKeys, getLatestCoachDigest } from "@/lib/coach-api";

/**
 * Learning Coach card (§4.10; §3.1 growth mindset) — surfaces the learner's
 * latest AI weekly coaching digest on the dashboard. Renders nothing until the
 * first digest exists (the weekly sweep composes them), so it never shows an
 * empty shell.
 */
export function CoachCard() {
	const { t } = useTranslation("engagement");
	const { data } = useQuery({
		queryKey: coachKeys.latest,
		queryFn: getLatestCoachDigest,
		staleTime: 5 * 60 * 1000,
	});

	if (!data) return null;

	return (
		<section className="overflow-hidden rounded-card border border-success/25 bg-gradient-to-br from-success/8 to-card p-5 shadow-card">
			<div className="flex items-center gap-2">
				<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
					<Sprout className="size-4.5" />
				</span>
				<p className="font-stats font-semibold text-success text-xs uppercase tracking-wide">
					{t("coach.eyebrow", { defaultValue: "Your coach" })}
				</p>
			</div>

			<h2 className="mt-3 font-display text-foreground text-lg leading-snug">
				{data.headline}
			</h2>
			<p className="mt-2 text-muted-foreground text-sm leading-relaxed">
				{data.message}
			</p>

			{data.action ? (
				<div className="mt-4 flex items-start gap-2.5 rounded-btn border border-success/20 bg-success/5 p-3">
					<Target className="mt-0.5 size-4 shrink-0 text-success" />
					<div className="min-w-0">
						<p className="font-medium text-foreground text-xs">
							{t("coach.focus", { defaultValue: "This week's focus" })}
						</p>
						<p className="mt-0.5 text-muted-foreground text-sm">
							{data.action}
						</p>
					</div>
				</div>
			) : null}
		</section>
	);
}
