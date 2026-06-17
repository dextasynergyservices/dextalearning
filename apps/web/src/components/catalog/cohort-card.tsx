import { Link } from "@tanstack/react-router";
import { CalendarDays, UserRound, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNgn, formatShortDate } from "@/lib/format";
import type { SampleCohort } from "@/lib/sample-data";
import { cn } from "@/lib/utils";

export function CohortCard({ cohort }: { cohort: SampleCohort }) {
	const { t, i18n } = useTranslation("academy");
	const isFree = cohort.priceNgn === 0;
	const seatsLeft = Math.max(0, cohort.capacity - cohort.seatsFilled);
	const locale = i18n.resolvedLanguage ?? "en";

	return (
		<Link
			to="/teachers/cohorts/$slug"
			params={{ slug: cohort.slug }}
			className="group flex flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover active:scale-[0.99]"
		>
			<div
				className={cn(
					"flex aspect-[16/9] flex-col justify-between bg-gradient-to-br p-4 text-white",
					cohort.gradient,
				)}
			>
				<div className="flex items-center justify-between">
					<CalendarDays className="size-6 text-white/85" />
					<span className="rounded-pill bg-black/25 px-2.5 py-0.5 font-stats text-xs backdrop-blur-sm">
						{t(`level.${cohort.level}`)}
					</span>
				</div>
				<p className="font-stats text-white/85 text-xs">
					{t("cohorts.starts", {
						date: formatShortDate(cohort.startsAt, locale),
					})}
				</p>
			</div>

			<div className="flex flex-1 flex-col p-4">
				<h3 className="line-clamp-2 font-display text-base text-slate-900 leading-snug">
					{cohort.title}
				</h3>
				<p className="mt-1.5 line-clamp-2 flex-1 text-slate-500 text-sm">
					{cohort.summary}
				</p>
				<div className="mt-3 flex items-center gap-3 text-slate-500 text-xs">
					<span className="inline-flex items-center gap-1">
						<CalendarDays className="size-3.5" />{" "}
						{t("cohorts.weeks", { count: cohort.weeks })}
					</span>
					<span className="inline-flex items-center gap-1">
						<UserRound className="size-3.5" /> {cohort.facilitatorName}
					</span>
				</div>
				<div className="mt-3 flex items-center justify-between border-slate-100 border-t pt-3">
					<span className="font-display text-base text-slate-900">
						{isFree ? t("card.free") : formatNgn(cohort.priceNgn)}
					</span>
					<span className="inline-flex items-center gap-1 text-amber-600 text-xs">
						<Users className="size-3.5" />{" "}
						{t("cohorts.seats_left", { count: seatsLeft })}
					</span>
				</div>
			</div>
		</Link>
	);
}
