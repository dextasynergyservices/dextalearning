import { Snowflake } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StreakFlame } from "@/components/engagement/streak-flame";
import type { StreakState, WeekActivityDay } from "@/lib/engagement-api";
import { cn } from "@/lib/utils";

// Fixed two-chip row (freezes cap at 2 server-side).
const FREEZE_SLOTS = ["freeze-1", "freeze-2"] as const;

function lossAversionKey(streak: StreakState): string {
	if (streak.atRisk) return "at_risk";
	if (streak.todayDone) return "today_done";
	if (streak.current === 0) return "start";
	return "keep_going";
}

/**
 * Dashboard streak card (§3.2): flame + current/longest, the two freeze
 * chips with an explainer, a 7-day activity strip and a loss-aversion line
 * that tells the learner exactly what today does to the flame.
 */
export function StreakPanel({
	streak,
	weekActivity,
	className,
}: {
	streak: StreakState;
	weekActivity: WeekActivityDay[];
	className?: string;
}) {
	const { t, i18n } = useTranslation("engagement");
	const dayLetter = new Intl.DateTimeFormat(i18n.language, {
		weekday: "narrow",
		timeZone: "UTC",
	});

	return (
		<section
			data-testid="streak-panel"
			className={cn(
				"rounded-card border border-border bg-card p-5 shadow-card",
				className,
			)}
		>
			<div className="flex items-start justify-between gap-4">
				<div>
					<p className="font-stats font-semibold text-muted-foreground text-xs uppercase tracking-wide">
						{t("streak.title")}
					</p>
					<div className="mt-2 flex items-center gap-2">
						<StreakFlame current={streak.current} atRisk={streak.atRisk} />
						<span className="text-muted-foreground text-sm">
							{t("streak.day_streak")}
						</span>
					</div>
					<p className="mt-1 font-stats text-muted-foreground text-xs">
						{t("streak.longest")}: {streak.longest}
					</p>
				</div>

				<div className="text-right">
					<p className="font-stats font-semibold text-muted-foreground text-xs uppercase tracking-wide">
						{t("streak.freezes")}
					</p>
					<div className="mt-2 flex justify-end gap-1.5">
						{FREEZE_SLOTS.map((slot, i) => (
							<span
								key={slot}
								className={cn(
									"flex size-8 items-center justify-center rounded-full",
									i < streak.freezes
										? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
										: "bg-muted text-muted-foreground/50",
								)}
							>
								<Snowflake className="size-4" />
							</span>
						))}
					</div>
					<p className="mt-2 max-w-44 text-muted-foreground text-xs">
						{t("streak.freeze_hint")}
					</p>
				</div>
			</div>

			<div className="mt-4 border-border border-t pt-4">
				<p className="font-stats font-semibold text-muted-foreground text-xs uppercase tracking-wide">
					{t("streak.this_week")}
				</p>
				<div className="mt-2 flex items-center justify-between gap-1 sm:justify-start sm:gap-3">
					{weekActivity.map((day) => (
						<div key={day.date} className="flex flex-col items-center gap-1">
							<span
								data-active={day.active || undefined}
								className={cn(
									"size-2.5 rounded-full",
									day.active ? "bg-brand-solid" : "bg-muted",
								)}
							/>
							<span className="text-[0.6rem] text-muted-foreground uppercase">
								{dayLetter.format(new Date(`${day.date}T00:00:00Z`))}
							</span>
						</div>
					))}
				</div>
			</div>

			<p
				className={cn(
					"mt-4 rounded-btn px-3 py-2 text-sm",
					streak.atRisk
						? "bg-warning/10 text-amber-700 dark:text-amber-300"
						: // Full-strength tint in dark: the 50% blend lands mid-grey and
							// drops foreground text to 3.8:1 (WCAG 1.4.3).
							"bg-brand-primary-light/50 text-foreground dark:bg-brand-primary-light",
				)}
			>
				{t(`streak.${lossAversionKey(streak)}`, { days: streak.current })}
			</p>
		</section>
	);
}
