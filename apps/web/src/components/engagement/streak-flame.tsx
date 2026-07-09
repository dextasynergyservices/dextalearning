import { motion, useReducedMotion } from "framer-motion";
import { Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * The animated streak flame (§3.2 loss aversion): lit + gently pulsing while
 * the streak lives, amber when it's at risk today, grey when there's no
 * streak. `compact` renders the small header variant.
 */
export function StreakFlame({
	current,
	atRisk = false,
	compact = false,
	className,
}: {
	current: number;
	atRisk?: boolean;
	compact?: boolean;
	className?: string;
}) {
	const { t } = useTranslation("engagement");
	const reducedMotion = useReducedMotion();
	const lit = current > 0;

	return (
		<span
			role="img"
			aria-label={t("streak.flame_label", { days: current })}
			title={t("streak.flame_label", { days: current })}
			className={cn(
				"inline-flex items-center",
				compact ? "gap-1" : "gap-1.5",
				className,
			)}
		>
			<motion.span
				className="inline-flex"
				animate={
					lit && !reducedMotion
						? { scale: [1, 1.12, 1], rotate: [0, -3, 3, 0] }
						: undefined
				}
				transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
			>
				<Flame
					aria-hidden
					className={cn(
						compact ? "size-4" : "size-6",
						lit
							? atRisk
								? "fill-amber-300 text-amber-500"
								: "fill-orange-400 text-orange-500"
							: "fill-transparent text-muted-foreground",
					)}
				/>
			</motion.span>
			<span
				className={cn(
					"font-stats font-bold tabular-nums",
					compact ? "text-sm" : "text-2xl",
					lit
						? atRisk
							? "text-amber-600 dark:text-amber-400"
							: "text-foreground"
						: "text-muted-foreground",
				)}
			>
				{current}
			</span>
		</span>
	);
}
