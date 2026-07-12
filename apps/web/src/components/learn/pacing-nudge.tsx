import { useQuery } from "@tanstack/react-query";
import { Gauge, Rabbit, Sparkles, TrendingUp } from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { getMyPacing, type PacingState, pacingKeys } from "@/lib/pacing-api";
import { cn } from "@/lib/utils";

const STYLE: Record<
	PacingState,
	{ icon: ComponentType<{ className?: string }>; tint: string }
> = {
	ahead: { icon: TrendingUp, tint: "text-success" },
	on_track: { icon: Gauge, tint: "text-brand-primary" },
	behind: { icon: Sparkles, tint: "text-amber-600 dark:text-amber-400" },
	rushing: { icon: Rabbit, tint: "text-amber-600 dark:text-amber-400" },
};

const DEFAULTS: Record<PacingState, string> = {
	ahead: "You're ahead of your weekly goal — great momentum!",
	on_track: "Nice steady pace — keep the rhythm going.",
	behind: "A little behind your weekly goal — one more keeps you on track.",
	rushing:
		"You're moving fast! A quick recap of what you learned makes it stick.",
};

/**
 * Adaptive pacing nudge (§4.10) shown on the lesson completion card. Fetched
 * only once a lesson is done (`enabled`), it calibrates the learner's rhythm
 * against their weekly goal — never a shaming message, always a next step.
 */
export function PacingNudge({ enabled }: { enabled: boolean }) {
	const { t } = useTranslation("engagement");
	const { data } = useQuery({
		queryKey: pacingKeys.me,
		queryFn: getMyPacing,
		enabled,
		staleTime: 60 * 1000,
	});

	if (!data) return null;
	const style = STYLE[data.state];
	const Icon = style.icon;

	return (
		<p
			role="status"
			className="mt-3 flex items-start gap-2 border-border/60 border-t pt-3 text-muted-foreground text-sm"
		>
			<Icon className={cn("mt-0.5 size-4 shrink-0", style.tint)} />
			<span>
				{t(`pacing.${data.state}`, {
					defaultValue: DEFAULTS[data.state],
					done: data.lessonsThisWeek,
					target: data.targetPerWeek ?? 0,
				})}
			</span>
		</p>
	);
}
