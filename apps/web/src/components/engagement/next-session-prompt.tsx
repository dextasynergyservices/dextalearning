import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarCheck2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateMyProfile } from "@/lib/content-api";
import { cn } from "@/lib/utils";

const OPTIONS = ["morning", "afternoon", "evening", "weekend"] as const;

/**
 * The §3.2 implementation-intention prompt at the moment of completion:
 * "When will you study next? Set it now." One tap saves the choice as the
 * learner's study schedule, which is exactly what the reminder engine sends
 * against — the intention and the nudge stay one and the same thing.
 */
export function NextSessionPrompt({ className }: { className?: string }) {
	const { t } = useTranslation("engagement");
	const queryClient = useQueryClient();
	const [chosen, setChosen] = useState<string | null>(null);

	const save = useMutation({
		mutationFn: (studySchedule: string) => updateMyProfile({ studySchedule }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
	});

	const pick = (value: string) => {
		setChosen(value);
		save.mutate(value);
	};

	return (
		<div
			data-testid="next-session-prompt"
			className={cn(
				"rounded-card border border-brand-primary/20 bg-brand-primary-light/30 p-4",
				className,
			)}
		>
			{chosen ? (
				<motion.p
					initial={{ opacity: 0, y: 6 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ type: "spring", stiffness: 260, damping: 22 }}
					className="flex items-center gap-2 font-medium text-foreground text-sm"
				>
					<CheckCircle2 className="size-5 shrink-0 text-success" />
					{t("next_session.saved", {
						when: t(`next_session.saved_when.${chosen}`),
					})}
				</motion.p>
			) : (
				<>
					<p className="flex items-center gap-2 font-display text-foreground">
						<CalendarCheck2 className="size-5 shrink-0 text-brand-primary" />
						{t("next_session.title")}
					</p>
					<p className="mt-0.5 pl-7 text-muted-foreground text-xs">
						{t("next_session.hint")}
					</p>
					<div className="mt-3 flex flex-wrap gap-2 pl-7">
						{OPTIONS.map((value) => (
							<button
								key={value}
								type="button"
								onClick={() => pick(value)}
								disabled={save.isPending}
								className="rounded-pill border border-border bg-card px-3.5 py-2 font-medium text-foreground text-sm transition-colors hover:border-brand-primary hover:text-brand-primary active:scale-[0.98]"
							>
								{t(`next_session.options.${value}`)}
							</button>
						))}
					</div>
				</>
			)}
		</div>
	);
}
