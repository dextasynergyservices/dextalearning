import { useQuery } from "@tanstack/react-query";
import {
	CheckCircle2,
	CircleSlash,
	Clock,
	ShoppingBag,
	TrendingUp,
	Trophy,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import {
	earningsKeys,
	formatMoney,
	getEarningsLedger,
	type SaleLedgerRow,
	type SaleOutcome,
} from "@/lib/earnings-api";
import { cn } from "@/lib/utils";

/**
 * The creator's Earn-Back ledger (§8.5): every sale and what became of it,
 * projected from the frozen Order snapshots.
 *
 * It exists because the payout history above it is the CASH ledger, and cash
 * goes silent exactly where the creator most needs an answer: at e = 100 a
 * learner who finishes on time forfeits nothing, so no payout row is written
 * and a real sale leaves no trace. Without this, "nobody bought my course" and
 * "everybody who bought it finished" render identically as an empty page.
 *
 * The money rule enforced here: the amount on a row ALWAYS means "earned so
 * far". A live escrow's upside is conditional, so it never appears in that
 * column — it goes in the explanation line, in "only if" language. Otherwise
 * the column would mean two different things and the totals wouldn't reconcile.
 */
export function EarnBackLedger() {
	const { t } = useTranslation("authoring");
	const { data, isPending } = useQuery({
		queryKey: earningsKeys.ledger,
		queryFn: getEarningsLedger,
	});

	if (isPending) {
		return (
			<section className="space-y-2 rounded-card border border-border bg-card p-4 shadow-card">
				<Skeleton className="h-16 rounded-card" />
				<Skeleton className="h-14 rounded-card" />
				<Skeleton className="h-14 rounded-card" />
			</section>
		);
	}
	if (!data) return null;

	const { currency, summary, rows } = data;

	return (
		<section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
			<header className="border-border border-b px-5 py-4">
				<h3 className="font-display text-foreground text-lg">
					{t("ledger.title", { defaultValue: "Earn-Back ledger" })}
				</h3>
				<p className="mt-0.5 text-muted-foreground text-sm">
					{t("ledger.subtitle", {
						defaultValue:
							"Every sale of your content and what became of it. Your payouts above show only the cash that moved.",
					})}
				</p>
			</header>

			{rows.length === 0 ? (
				<div className="px-5 py-12 text-center">
					<ShoppingBag className="mx-auto size-8 text-muted-foreground" />
					<p className="mt-3 font-display text-foreground">
						{t("ledger.empty_title", { defaultValue: "No sales yet" })}
					</p>
					<p className="mx-auto mt-1 max-w-sm text-muted-foreground text-sm">
						{t("ledger.empty_body", {
							defaultValue:
								"When someone buys your paid content, the sale appears here — including sales that earn you nothing because the learner finished on time.",
						})}
					</p>
				</div>
			) : (
				<>
					{/* 2×2 on mobile, 4-across from sm. Figures, not tiles: the page
					    already has a tile grid and nesting a second one buries the rows. */}
					<dl className="grid grid-cols-2 gap-px border-border border-b bg-border sm:grid-cols-4">
						<Figure
							label={t("ledger.sales", { defaultValue: "Sales" })}
							value={String(summary.salesCount)}
						/>
						<Figure
							label={t("ledger.gross", { defaultValue: "Gross" })}
							value={formatMoney(summary.grossMajor, currency)}
						/>
						<Figure
							label={t("ledger.earned", { defaultValue: "You earned" })}
							value={formatMoney(summary.earnedMajor, currency)}
						/>
						<Figure
							label={t("ledger.at_stake", { defaultValue: "At stake" })}
							value={formatMoney(summary.atStakeMajor, currency)}
							hint={t("ledger.at_stake_hint", {
								defaultValue: "Only if deadlines are missed",
							})}
						/>
					</dl>

					{/* The headline. At high Earn-Back percentages an honest earnings
					    page is mostly zeroes — this is the line that makes those zeroes
					    legible as the success they are, instead of an absence. */}
					{summary.finishedOnTimeCount > 0 ? (
						<p className="flex items-start gap-2.5 border-border border-b bg-success/5 px-5 py-3 text-sm">
							<Trophy className="mt-0.5 size-4 shrink-0 text-success" />
							<span className="text-foreground">
								{t("ledger.on_time_headline", {
									defaultValue:
										"{{count}} of {{total}} learners finished on time. They earned their money back — that's your Earn-Back working.",
									count: summary.finishedOnTimeCount,
									total: summary.salesCount,
								})}
							</span>
						</p>
					) : null}

					<ul className="divide-y divide-border">
						{rows.map((row) => (
							<LedgerRow key={row.orderId} row={row} />
						))}
					</ul>
				</>
			)}
		</section>
	);
}

function Figure({
	label,
	value,
	hint,
}: {
	label: string;
	value: string;
	hint?: string;
}) {
	return (
		<div className="bg-card px-4 py-3">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="mt-0.5 font-stats font-bold text-base text-foreground tabular-nums">
				{value}
			</dd>
			{hint ? (
				<p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
					{hint}
				</p>
			) : null}
		</div>
	);
}

/**
 * One sale. Stacks on mobile (title → meta → amount+pill) and lays out
 * horizontally from sm, so neither layout truncates the outcome away.
 */
function LedgerRow({ row }: { row: SaleLedgerRow }) {
	const { t, i18n } = useTranslation("authoring");
	const money = (n: number) => formatMoney(n, row.currency);
	const date = (iso: string) =>
		new Date(iso).toLocaleDateString(i18n.language, {
			day: "numeric",
			month: "short",
			year: "numeric",
		});

	/** Why this sale earned what it earned. Never blank — silence is the bug. */
	const explanation = (): string => {
		switch (row.outcome) {
			case "at_stake":
				return row.deadline
					? t("ledger.why_at_stake", {
							defaultValue:
								"You earn {{amount}} more only if they miss {{date}}.",
							amount: money(row.atStake),
							date: date(row.deadline),
						})
					: t("ledger.why_at_stake_nodate", {
							defaultValue:
								"You earn {{amount}} more only if they don't finish.",
							amount: money(row.atStake),
						});
			case "finished_on_time":
				return t("ledger.why_on_time", {
					defaultValue:
						"They finished in time and earned their money back — the {{pct}}% you set.",
					pct: row.earnBackPercentage ?? 100,
				});
			case "finished_late":
				return t("ledger.why_late", {
					defaultValue:
						"Finished {{count}} days late, so that slice of the Earn-Back came to you.",
					count: row.daysLate ?? 0,
				});
			case "deadline_missed":
				return t("ledger.why_missed", {
					defaultValue:
						"They never finished, so the full Earn-Back came to you.",
				});
			default:
				return t("ledger.why_settled", {
					defaultValue: "No Earn-Back on this one — paid to you at checkout.",
				});
		}
	};

	return (
		<li className="px-5 py-3.5">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium text-foreground text-sm">
						{row.entityTitle ??
							t("ledger.enrolment", { defaultValue: "Enrolment" })}
					</p>
					<p className="mt-0.5 truncate text-muted-foreground text-xs">
						{row.learnerName} · {date(row.soldAt)} · {money(row.gross)}
						{row.earnBackPercentage != null
							? ` · ${t("ledger.pct", {
									defaultValue: "{{pct}}% Earn-Back",
									pct: row.earnBackPercentage,
								})}`
							: ""}
					</p>
				</div>
				{/* Amount + pill share a row on mobile so the outcome never wraps
				    away from the number it explains. */}
				<div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
					<span
						className={cn(
							"font-stats font-bold text-sm tabular-nums",
							row.totalEarned > 0 ? "text-foreground" : "text-muted-foreground",
						)}
					>
						{money(row.totalEarned)}
					</span>
					<OutcomePill outcome={row.outcome} />
				</div>
			</div>
			<p className="mt-1.5 text-muted-foreground text-xs sm:mt-1">
				{explanation()}
			</p>
		</li>
	);
}

function OutcomePill({ outcome }: { outcome: SaleOutcome }) {
	const { t } = useTranslation("authoring");
	const map: Record<
		SaleOutcome,
		{ label: string; cls: string; icon: typeof Clock }
	> = {
		settled: {
			label: t("ledger.outcome_settled", { defaultValue: "Paid" }),
			cls: "bg-success/15 text-success",
			icon: CheckCircle2,
		},
		at_stake: {
			label: t("ledger.outcome_at_stake", { defaultValue: "At stake" }),
			cls: "bg-brand-primary/15 text-brand-primary",
			icon: Clock,
		},
		// Success tone on purpose: the learner completing is the outcome the
		// platform — and the creator, when they set the percentage — asked for.
		// Rendering it as a loss would editorialise against our own model.
		finished_on_time: {
			label: t("ledger.outcome_on_time", { defaultValue: "Finished on time" }),
			cls: "bg-success/15 text-success",
			icon: Trophy,
		},
		finished_late: {
			label: t("ledger.outcome_late", { defaultValue: "Finished late" }),
			cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
			icon: TrendingUp,
		},
		deadline_missed: {
			label: t("ledger.outcome_missed", { defaultValue: "Deadline missed" }),
			cls: "bg-muted text-muted-foreground",
			icon: CircleSlash,
		},
	};
	const o = map[outcome];
	const Icon = o.icon;
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center gap-1 rounded-pill px-2.5 py-1 font-medium text-xs",
				o.cls,
			)}
		>
			<Icon className="size-3" />
			{o.label}
		</span>
	);
}
