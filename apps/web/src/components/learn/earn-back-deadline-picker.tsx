import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { EnrollableType } from "@/lib/content-api";
import { formatMoney } from "@/lib/content-api";
import { setEarnBackDeadline } from "@/lib/payments-api";
import { cn } from "@/lib/utils";

/** Offer round, human windows — never a bare number box to fill in. */
const PRESETS = [7, 14, 30, 45, 60, 90];

function optionsFor(maxDays: number): number[] {
	return [...new Set([...PRESETS.filter((d) => d < maxDays), maxDays])].sort(
		(a, b) => a - b,
	);
}

function dateFor(days: number, language: string): string {
	return new Date(Date.now() + days * 86_400_000).toLocaleDateString(language, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

/**
 * The learner's Earn-Back deadline commitment (§4.11.1) — shown right after
 * payment, and again on the hub if they skipped it.
 *
 * Deliberately a *choice of windows*, not a number input: the decision is "how
 * hard do I want to push myself", and round options make that legible at a
 * glance. The consequence (this is final) is stated before they commit, not
 * discovered afterwards — a commitment device the learner didn't understand
 * they were making isn't one.
 */
export function EarnBackDeadlinePicker({
	type,
	entityId,
	maxDays,
	base,
	currency,
	onDone,
}: {
	type: EnrollableType;
	entityId: string;
	maxDays: number;
	base?: number;
	currency?: string;
	onDone?: () => void;
}) {
	const { t, i18n } = useTranslation("authoring");
	const queryClient = useQueryClient();
	const options = optionsFor(maxDays);
	// Pre-select the most committed option that isn't punishing — the shortest
	// on offer would be a trap, the longest defeats the point. Middle ground.
	const [days, setDays] = useState<number>(
		options[Math.floor((options.length - 1) / 2)] ?? maxDays,
	);

	const commit = useMutation({
		mutationFn: () => setEarnBackDeadline(type, entityId, days),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["earn-back-status", type, entityId],
			});
			toast.success(
				t("earnback_deadline.saved", { defaultValue: "Deadline set" }),
			);
			onDone?.();
		},
		onError: (e) => toast.error(e.message),
	});

	return (
		<section className="rounded-card border border-brand-primary/25 bg-brand-primary-light/20 p-4 shadow-card sm:p-5">
			<div className="flex items-start gap-3">
				<span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-btn bg-brand-solid text-white">
					<CalendarClock className="size-4.5" />
				</span>
				<div className="min-w-0 flex-1">
					<h2 className="font-display text-foreground">
						{t("earnback_deadline.title", {
							defaultValue: "Set your Earn-Back deadline",
						})}
					</h2>
					<p className="mt-0.5 text-muted-foreground text-sm">
						{base != null && currency
							? t("earnback_deadline.body_amount", {
									defaultValue:
										"Finish by the date you pick and we send {{amount}} back to your card. You choose — anything up to {{max}} days.",
									amount: formatMoney(currency, base),
									max: maxDays,
								})
							: t("earnback_deadline.body", {
									defaultValue:
										"Finish by the date you pick and your Earn-Back comes back to your card. You choose — anything up to {{max}} days.",
									max: maxDays,
								})}
					</p>
				</div>
			</div>

			<fieldset className="mt-4" disabled={commit.isPending}>
				<legend className="sr-only">
					{t("earnback_deadline.legend", {
						defaultValue: "Choose how many days you need",
					})}
				</legend>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
					{options.map((option) => {
						const on = option === days;
						return (
							<button
								key={option}
								type="button"
								onClick={() => setDays(option)}
								aria-pressed={on}
								className={cn(
									"flex min-h-[3.25rem] flex-col items-start justify-center rounded-btn border px-3 py-2 text-left transition-colors disabled:opacity-60",
									on
										? "border-brand-primary bg-brand-primary/10"
										: "border-border bg-card hover:bg-accent",
								)}
							>
								<span className="flex w-full items-center justify-between gap-1">
									<span
										className={cn(
											"font-semibold text-sm",
											on ? "text-brand-primary" : "text-foreground",
										)}
									>
										{t("earnback_deadline.days", {
											defaultValue: "{{count}} days",
											count: option,
										})}
									</span>
									{on ? (
										<Check className="size-3.5 shrink-0 text-brand-primary" />
									) : null}
								</span>
								<span className="mt-0.5 block truncate text-[0.7rem] text-muted-foreground">
									{dateFor(option, i18n.language)}
								</span>
							</button>
						);
					})}
				</div>
			</fieldset>

			<p className="mt-3 text-muted-foreground text-xs">
				{t("earnback_deadline.final_note", {
					defaultValue:
						"This is final — you can't change it later. Finish late and 2% of your Earn-Back is deducted for each day.",
				})}
			</p>

			<button
				type="button"
				onClick={() => commit.mutate()}
				disabled={commit.isPending}
				className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-btn bg-brand-solid px-4 font-semibold text-sm text-white transition-colors hover:bg-brand-solid-hover active:scale-[0.99] disabled:opacity-50 sm:w-auto"
			>
				{commit.isPending ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<CalendarClock className="size-4" />
				)}
				{t("earnback_deadline.confirm", {
					defaultValue: "Commit to {{date}}",
					date: dateFor(days, i18n.language),
				})}
			</button>
		</section>
	);
}
