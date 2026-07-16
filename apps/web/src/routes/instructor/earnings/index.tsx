import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
	type StatTileData,
	StatTileGrid,
} from "@/components/analytics/stat-tile";
import { StudioShell } from "@/components/authoring/studio-shell";
import { EarnBackLedger } from "@/components/instructor/earn-back-ledger";
import { PayoutAccounts } from "@/components/instructor/payout-accounts";
import { Skeleton } from "@/components/ui/skeleton";
import {
	earningsKeys,
	formatMoney,
	getEarnings,
	type PayoutHistoryRow,
	type PayoutStatus,
} from "@/lib/earnings-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/instructor/earnings/")({
	component: EarningsPage,
});

function EarningsPage() {
	const { t } = useTranslation("authoring");
	const earnings = useQuery({
		queryKey: earningsKeys.summary,
		queryFn: getEarnings,
	});

	const summary = earnings.data?.summary;
	const currency = summary?.currency ?? "NGN";
	const tiles: StatTileData[] = [
		{
			key: "lifetime",
			icon: Wallet,
			value: summary ? formatMoney(summary.lifetimeProcessed, currency) : null,
			label: t("earnings.lifetime", { defaultValue: "Lifetime earnings" }),
		},
		{
			key: "pending",
			icon: Clock,
			value: summary ? formatMoney(summary.pending, currency) : null,
			label: t("earnings.pending", { defaultValue: "Pending payout" }),
		},
		{
			key: "count",
			icon: CheckCircle2,
			value: summary ? summary.processedCount : null,
			label: t("earnings.payouts", { defaultValue: "Payouts received" }),
		},
		{
			key: "failed",
			icon: AlertTriangle,
			value: summary ? formatMoney(summary.failed, currency) : null,
			label: t("earnings.failed", { defaultValue: "Failed" }),
		},
	];

	return (
		<StudioShell
			title={t("earnings.title", { defaultValue: "Earnings" })}
			area="instructor"
		>
			<div className="space-y-6">
				<div>
					<h2 className="font-display text-2xl text-foreground sm:text-3xl">
						{t("earnings.title", { defaultValue: "Earnings" })}
					</h2>
					<p className="mt-1 text-muted-foreground">
						{t("earnings.subtitle", {
							defaultValue:
								"Your payouts from paid enrolments. You keep 90% of every sale that settles as revenue.",
						})}
					</p>
				</div>

				<PayoutAccounts />

				<StatTileGrid tiles={tiles} />

				<PayoutHistory
					rows={earnings.data?.history}
					pending={earnings.isPending}
				/>

				{/* The cash ledger above can't see a sale that paid nothing. This can. */}
				<EarnBackLedger />
			</div>
		</StudioShell>
	);
}

function PayoutHistory({
	rows,
	pending,
}: {
	rows: PayoutHistoryRow[] | undefined;
	pending: boolean;
}) {
	const { t } = useTranslation("authoring");

	return (
		<section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
			<h3 className="border-border border-b px-5 py-4 font-display text-foreground text-lg">
				{t("earnings.history", { defaultValue: "Payout history" })}
			</h3>

			{pending ? (
				<div className="space-y-2 p-4">
					<Skeleton className="h-14 rounded-card" />
					<Skeleton className="h-14 rounded-card" />
				</div>
			) : !rows || rows.length === 0 ? (
				<div className="px-5 py-12 text-center">
					<Wallet className="mx-auto size-8 text-muted-foreground" />
					<p className="mt-3 font-display text-foreground">
						{t("earnings.empty_title", {
							defaultValue: "No payouts yet",
						})}
					</p>
					{/* Not "your share appears here" — at 100% Earn-Back a learner who
					    finishes on time forfeits nothing, so a real sale correctly pays
					    out nothing and this table stays empty. Point at the ledger. */}
					<p className="mx-auto mt-1 max-w-sm text-muted-foreground text-sm">
						{t("earnings.empty_body", {
							defaultValue:
								"This is the cash we've transferred to you. Sales that earn you nothing — because the learner finished on time — show in your Earn-Back ledger below.",
						})}
					</p>
				</div>
			) : (
				<ul className="divide-y divide-border">
					{rows.map((row) => (
						<li key={row.id} className="flex items-center gap-3 px-5 py-3.5">
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-foreground text-sm">
									{row.entityTitle ??
										t("earnings.enrolment", {
											defaultValue: "Enrolment",
										})}
								</p>
								<p className="mt-0.5 text-muted-foreground text-xs">
									{new Date(row.triggeredAt).toLocaleDateString()}
								</p>
							</div>
							<span className="font-stats font-bold text-foreground text-sm tabular-nums">
								{formatMoney(row.amount, row.currency)}
							</span>
							<StatusPill status={row.status} />
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

function StatusPill({ status }: { status: PayoutStatus }) {
	const { t } = useTranslation("authoring");
	const map: Record<
		"pending" | "processed" | "failed",
		{ label: string; cls: string }
	> = {
		processed: {
			label: t("earnings.status_processed", { defaultValue: "Paid" }),
			cls: "bg-success/15 text-success",
		},
		pending: {
			label: t("earnings.status_pending", { defaultValue: "Pending" }),
			cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
		},
		failed: {
			label: t("earnings.status_failed", { defaultValue: "Failed" }),
			cls: "bg-destructive/15 text-destructive",
		},
	};
	const s = map[status ?? "pending"];
	return (
		<span
			className={cn(
				"shrink-0 rounded-pill px-2.5 py-1 font-medium text-xs",
				s.cls,
			)}
		>
			{s.label}
		</span>
	);
}
