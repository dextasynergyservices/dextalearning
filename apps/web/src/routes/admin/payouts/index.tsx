import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangle,
	CheckCircle2,
	Clock,
	Loader2,
	RotateCcw,
	Send,
	Undo2,
	Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
	type StatTileData,
	StatTileGrid,
} from "@/components/analytics/stat-tile";
import { StudioShell } from "@/components/authoring/studio-shell";
import { Skeleton } from "@/components/ui/skeleton";
import {
	type AdminPayoutRow,
	type AdminRefundRow,
	adminPayoutKeys,
	getPendingPayouts,
	getRecentPayouts,
	getRecentRefunds,
	type PendingPayoutGroup,
	retryPayout,
	retryRefund,
	runAllPayouts,
} from "@/lib/admin-payouts-api";
import { formatMoney, type PayoutStatus } from "@/lib/earnings-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/payouts/")({
	component: AdminPayoutsPage,
});

function AdminPayoutsPage() {
	const { t } = useTranslation("authoring");
	const qc = useQueryClient();
	const pending = useQuery({
		queryKey: adminPayoutKeys.pending,
		queryFn: getPendingPayouts,
	});
	const recent = useQuery({
		queryKey: adminPayoutKeys.recent,
		queryFn: getRecentPayouts,
	});
	const refunds = useQuery({
		queryKey: adminPayoutKeys.refunds,
		queryFn: getRecentRefunds,
	});

	const runAll = useMutation({
		mutationFn: runAllPayouts,
		onSuccess: ({ queued, skipped }) => {
			toast.success(
				t("admin_payouts.run_done", {
					defaultValue: "Queued {{queued}} payout(s); {{skipped}} skipped",
					queued,
					skipped,
				}),
			);
			qc.invalidateQueries({ queryKey: adminPayoutKeys.pending });
			qc.invalidateQueries({ queryKey: adminPayoutKeys.recent });
		},
		onError: (e) => toast.error(e.message),
	});

	const currency = pending.data?.groups[0]?.currency ?? "NGN";
	const tiles: StatTileData[] = [
		{
			key: "pending",
			icon: Clock,
			value: pending.data
				? formatMoney(pending.data.totalPending, currency)
				: null,
			label: t("admin_payouts.total_pending", {
				defaultValue: "Total pending",
			}),
		},
		{
			key: "payable",
			icon: CheckCircle2,
			value: pending.data
				? formatMoney(pending.data.payableTotal, currency)
				: null,
			label: t("admin_payouts.payable_now", { defaultValue: "Payable now" }),
		},
		{
			key: "instructors",
			icon: Wallet,
			value: pending.data ? pending.data.groups.length : null,
			label: t("admin_payouts.instructors_owed", {
				defaultValue: "Instructors owed",
			}),
		},
		// Refunds are money out too. Leaving them off this page is why an empty
		// payouts table reads as "nothing happened" when a learner was paid back.
		{
			key: "refunded",
			icon: Undo2,
			value: refunds.data
				? formatMoney(
						refunds.data.refunds
							.filter((r) => r.status === "processed")
							.reduce((sum, r) => sum + r.amount, 0),
						refunds.data.refunds[0]?.currency ?? currency,
					)
				: null,
			label: t("admin_payouts.refunded_total", {
				defaultValue: "Earn-Back refunded",
			}),
		},
	];

	const payableCount =
		pending.data?.groups.filter((g) => g.payable).length ?? 0;

	return (
		<StudioShell
			title={t("admin_payouts.title", { defaultValue: "Payouts" })}
			area="admin"
		>
			<div className="space-y-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h2 className="font-display text-2xl text-foreground sm:text-3xl">
							{t("admin_payouts.title", { defaultValue: "Payouts" })}
						</h2>
						<p className="mt-1 text-muted-foreground">
							{t("admin_payouts.subtitle", {
								defaultValue:
									"Instructor payouts and learner Earn-Back refunds. Run a bulk payout once accounts are verified.",
							})}
						</p>
					</div>
					<button
						type="button"
						onClick={() => runAll.mutate()}
						disabled={runAll.isPending || payableCount === 0}
						className="inline-flex h-11 items-center justify-center gap-2 rounded-btn bg-brand-solid px-4 font-semibold text-sm text-white transition-colors hover:bg-brand-solid-hover disabled:opacity-50"
					>
						{runAll.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Send className="size-4" />
						)}
						{t("admin_payouts.run_all", {
							defaultValue: "Run all payouts ({{count}})",
							count: payableCount,
						})}
					</button>
				</div>

				<StatTileGrid tiles={tiles} />

				<PendingByInstructor
					groups={pending.data?.groups}
					pending={pending.isPending}
				/>

				<RecentPayouts
					rows={recent.data?.payouts}
					pending={recent.isPending}
					onRetry={(id) =>
						retryPayout(id).then(() => {
							toast.success(
								t("admin_payouts.retry_queued", {
									defaultValue: "Retry queued",
								}),
							);
							qc.invalidateQueries({ queryKey: adminPayoutKeys.recent });
							qc.invalidateQueries({ queryKey: adminPayoutKeys.pending });
						})
					}
				/>

				<RecentRefunds
					rows={refunds.data?.refunds}
					pending={refunds.isPending}
					onRetry={(id) =>
						retryRefund(id)
							.then(() => {
								toast.success(
									t("admin_payouts.refund_retry_queued", {
										defaultValue: "Refund re-sent",
									}),
								);
								qc.invalidateQueries({ queryKey: adminPayoutKeys.refunds });
							})
							// A refund can be unretryable (forfeited, or the original
							// charge reference is gone) — surface the reason rather than
							// leaving the admin clicking a button that does nothing.
							.catch((e: Error) => toast.error(e.message))
					}
				/>
			</div>
		</StudioShell>
	);
}

function PendingByInstructor({
	groups,
	pending,
}: {
	groups: PendingPayoutGroup[] | undefined;
	pending: boolean;
}) {
	const { t } = useTranslation("authoring");
	if (pending) return <Skeleton className="h-40 rounded-card" />;

	return (
		<section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
			<h3 className="border-border border-b px-5 py-4 font-display text-foreground text-lg">
				{t("admin_payouts.pending_title", {
					defaultValue: "Pending by instructor",
				})}
			</h3>
			{!groups || groups.length === 0 ? (
				<div className="px-5 py-12 text-center">
					<CheckCircle2 className="mx-auto size-8 text-success" />
					<p className="mt-3 font-display text-foreground">
						{t("admin_payouts.all_clear", {
							defaultValue: "No pending payouts",
						})}
					</p>
				</div>
			) : (
				<ul className="divide-y divide-border">
					{groups.map((g) => (
						<li
							key={g.instructorId}
							className="flex items-center gap-3 px-5 py-3.5"
						>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-foreground text-sm">
									{g.instructorName}
								</p>
								<p className="text-muted-foreground text-xs">
									{t("admin_payouts.count", {
										defaultValue: "{{count}} pending",
										count: g.pendingCount,
									})}
								</p>
							</div>
							<span className="font-stats font-bold text-foreground text-sm tabular-nums">
								{formatMoney(g.pendingTotal, g.currency)}
							</span>
							{g.payable ? (
								<span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-success/15 px-2.5 py-1 font-medium text-success text-xs">
									<CheckCircle2 className="size-3" />
									{t("admin_payouts.payable", { defaultValue: "Payable" })}
								</span>
							) : (
								<span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-amber-500/15 px-2.5 py-1 font-medium text-amber-700 text-xs dark:text-amber-300">
									<AlertTriangle className="size-3" />
									{t("admin_payouts.no_account", {
										defaultValue: "No account",
									})}
								</span>
							)}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

function RecentPayouts({
	rows,
	pending,
	onRetry,
}: {
	rows: AdminPayoutRow[] | undefined;
	pending: boolean;
	onRetry: (id: string) => void;
}) {
	const { t } = useTranslation("authoring");
	if (pending) return <Skeleton className="h-40 rounded-card" />;

	return (
		<section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
			<h3 className="border-border border-b px-5 py-4 font-display text-foreground text-lg">
				{t("admin_payouts.recent_title", { defaultValue: "Recent activity" })}
			</h3>
			{!rows || rows.length === 0 ? (
				<div className="px-5 py-10 text-center">
					<p className="text-muted-foreground text-sm">
						{t("admin_payouts.no_activity", {
							defaultValue: "No payout activity yet.",
						})}
					</p>
					{/* The empty table is ambiguous on its own: an on-time, 100%
					    Earn-Back finish forfeits nothing, so it pays the instructor
					    nothing and correctly produces no row here. Say so. */}
					<p className="mx-auto mt-2 max-w-md text-muted-foreground text-xs">
						{t("admin_payouts.no_activity_hint", {
							defaultValue:
								"Instructors are paid from guaranteed revenue and forfeited Earn-Back. A learner who finishes on time forfeits nothing, so that sale pays out nothing here — check Earn-Back refunds below.",
						})}
					</p>
				</div>
			) : (
				<ul className="divide-y divide-border">
					{rows.map((r) => (
						<li key={r.id} className="flex items-center gap-3 px-5 py-3">
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-foreground text-sm">
									{r.instructorName}
								</p>
								<p className="truncate text-muted-foreground text-xs">
									{r.entityTitle ?? "—"} ·{" "}
									{new Date(r.triggeredAt).toLocaleDateString()}
									{r.failedReason ? ` · ${r.failedReason}` : ""}
								</p>
							</div>
							<span className="font-stats font-bold text-foreground text-sm tabular-nums">
								{formatMoney(r.amount, r.currency)}
							</span>
							<PayoutStatusPill status={r.status} />
							{r.status === "failed" ? (
								<button
									type="button"
									onClick={() => onRetry(r.id)}
									aria-label={t("admin_payouts.retry", {
										defaultValue: "Retry",
									})}
									className="flex size-8 shrink-0 items-center justify-center rounded-btn text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
								>
									<RotateCcw className="size-4" />
								</button>
							) : null}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

/**
 * Learner Earn-Back refunds (§4.11.5). Read-only: the durable worker owns
 * retries, so there's no button here — this exists so an Admin can see that a
 * learner's money actually moved, and so the "Earn-Back refund failed" alert
 * has somewhere to land.
 */
function RecentRefunds({
	rows,
	pending,
	onRetry,
}: {
	rows: AdminRefundRow[] | undefined;
	pending: boolean;
	onRetry: (id: string) => void;
}) {
	const { t } = useTranslation("authoring");
	if (pending) return <Skeleton className="h-40 rounded-card" />;

	return (
		<section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
			<div className="border-border border-b px-5 py-4">
				<h3 className="font-display text-foreground text-lg">
					{t("admin_payouts.refunds_title", {
						defaultValue: "Earn-Back refunds",
					})}
				</h3>
				<p className="mt-0.5 text-muted-foreground text-xs">
					{t("admin_payouts.refunds_subtitle", {
						defaultValue:
							"Refunds to learners who completed in time. Sent to their original payment method automatically.",
					})}
				</p>
			</div>
			{!rows || rows.length === 0 ? (
				<p className="px-5 py-10 text-center text-muted-foreground text-sm">
					{t("admin_payouts.no_refunds", {
						defaultValue: "No Earn-Back refunds yet.",
					})}
				</p>
			) : (
				<ul className="divide-y divide-border">
					{rows.map((r) => (
						<li key={r.id} className="flex items-center gap-3 px-5 py-3">
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-foreground text-sm">
									{r.learnerName}
								</p>
								<p className="truncate text-muted-foreground text-xs">
									{r.entityTitle ?? "—"} ·{" "}
									{new Date(r.calculatedAt).toLocaleDateString()}
									{r.daysLate > 0
										? ` · ${t("admin_payouts.days_late", {
												defaultValue: "{{count}} days late",
												count: r.daysLate,
											})}`
										: ` · ${t("admin_payouts.on_time", {
												defaultValue: "on time",
											})}`}
									{r.failedReason ? ` · ${r.failedReason}` : ""}
								</p>
							</div>
							<span className="font-stats font-bold text-foreground text-sm tabular-nums">
								{formatMoney(r.amount, r.currency)}
							</span>
							<RefundStatusPill status={r.status} />
							{/* Only a failed refund is actionable — the worker owns the
							    happy path, and a forfeited one has nothing to send. */}
							{r.status === "failed" ? (
								<button
									type="button"
									onClick={() => onRetry(r.id)}
									aria-label={t("admin_payouts.refund_retry", {
										defaultValue: "Re-send refund",
									})}
									title={t("admin_payouts.refund_retry", {
										defaultValue: "Re-send refund",
									})}
									className="flex size-8 shrink-0 items-center justify-center rounded-btn text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
								>
									<RotateCcw className="size-4" />
								</button>
							) : null}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

function RefundStatusPill({ status }: { status: AdminRefundRow["status"] }) {
	const { t } = useTranslation("authoring");
	const map: Record<
		"pending" | "processed" | "failed" | "no_payout",
		{ label: string; cls: string }
	> = {
		processed: {
			label: t("admin_payouts.refund_processed", { defaultValue: "Refunded" }),
			cls: "bg-success/15 text-success",
		},
		pending: {
			label: t("admin_payouts.refund_pending", { defaultValue: "Sending" }),
			cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
		},
		failed: {
			label: t("admin_payouts.refund_failed", { defaultValue: "Failed" }),
			cls: "bg-destructive/15 text-destructive",
		},
		no_payout: {
			label: t("admin_payouts.refund_none", { defaultValue: "Forfeited" }),
			cls: "bg-muted text-muted-foreground",
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

function PayoutStatusPill({ status }: { status: PayoutStatus }) {
	const { t } = useTranslation("authoring");
	const map: Record<
		"pending" | "processed" | "failed",
		{ label: string; cls: string }
	> = {
		processed: {
			label: t("admin_payouts.status_processed", { defaultValue: "Paid" }),
			cls: "bg-success/15 text-success",
		},
		pending: {
			label: t("admin_payouts.status_pending", { defaultValue: "Pending" }),
			cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
		},
		failed: {
			label: t("admin_payouts.status_failed", { defaultValue: "Failed" }),
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
