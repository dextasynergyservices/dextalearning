import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Coins, Landmark, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { StudioShell } from "@/components/authoring/studio-shell";
import { Skeleton } from "@/components/ui/skeleton";
import {
	adminEarningsKeys,
	getPlatformEarnings,
	type PlatformEarningsRow,
	type PlatformEarningsSummary,
} from "@/lib/admin-earnings-api";
import { formatMoney } from "@/lib/content-api";

export const Route = createFileRoute("/admin/earnings/")({
	component: AdminEarningsPage,
});

/**
 * Platform earnings (§2, §15). What the platform has actually taken — the
 * non-refundable fee plus its cut of guaranteed revenue — and which content
 * earned it. Read-only; every figure comes from settled orders' frozen
 * snapshots, so historic rows keep the terms they were sold under.
 */
function AdminEarningsPage() {
	const { t } = useTranslation("authoring");
	const { data, isPending } = useQuery({
		queryKey: adminEarningsKeys.overview,
		queryFn: getPlatformEarnings,
	});

	return (
		<StudioShell
			title={t("admin_earnings.title", { defaultValue: "Earnings" })}
			area="admin"
		>
			<div className="space-y-6">
				<div>
					<h2 className="flex items-center gap-2 font-display text-2xl text-foreground sm:text-3xl">
						<TrendingUp className="size-6 text-brand-primary" />
						{t("admin_earnings.heading", {
							defaultValue: "Platform earnings",
						})}
					</h2>
					<p className="mt-1 text-muted-foreground">
						{t("admin_earnings.subtitle", {
							defaultValue:
								"What the platform has taken across every settled order. Each order counts on the terms it was sold under, so changing a setting never rewrites history.",
						})}
					</p>
				</div>

				{isPending || !data ? (
					<div className="space-y-4">
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							{[0, 1, 2, 3].map((i) => (
								<Skeleton key={i} className="h-24 rounded-card" />
							))}
						</div>
						<Skeleton className="h-64 rounded-card" />
					</div>
				) : (
					<>
						<SummaryTiles summary={data.summary} />
						<EntityBreakdown
							rows={data.entities}
							currency={data.summary.currency}
						/>
					</>
				)}
			</div>
		</StudioShell>
	);
}

function SummaryTiles({ summary }: { summary: PlatformEarningsSummary }) {
	const { t } = useTranslation("authoring");
	const money = (n: number) => formatMoney(summary.currency, n);

	const tiles: {
		key: string;
		icon: ComponentType<{ className?: string }>;
		label: string;
		value: string;
		help: string;
		accent?: boolean;
	}[] = [
		{
			key: "take",
			icon: Landmark,
			label: t("admin_earnings.take", { defaultValue: "Platform take" }),
			value: money(summary.platformTake),
			help: t("admin_earnings.take_help", {
				defaultValue: "The fee plus the platform's cut of revenue.",
			}),
			accent: true,
		},
		{
			key: "fee",
			icon: Coins,
			label: t("admin_earnings.fee", { defaultValue: "Platform fee" }),
			value: money(summary.platformFee),
			help: t("admin_earnings.fee_help", {
				defaultValue: "Non-refundable, taken off the top of every sale.",
			}),
		},
		{
			key: "gross",
			icon: Wallet,
			label: t("admin_earnings.gross", { defaultValue: "Gross volume" }),
			value: money(summary.grossVolume),
			help: t("admin_earnings.gross_help", {
				defaultValue: "{{count}} settled order",
				defaultValue_other: "{{count}} settled orders",
				count: summary.orderCount,
			}),
		},
		{
			key: "instructors",
			icon: PiggyBank,
			label: t("admin_earnings.instructors", {
				defaultValue: "Instructor earnings",
			}),
			value: money(summary.instructorEarnings),
			help: t("admin_earnings.instructors_help", {
				defaultValue: "Credited to creators.",
			}),
		},
	];

	return (
		<>
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{tiles.map((tile) => (
					<section
						key={tile.key}
						className={
							tile.accent
								? "rounded-card border border-brand-primary/25 bg-brand-primary-light/25 p-5 shadow-card"
								: "rounded-card border border-border bg-card p-5 shadow-card"
						}
					>
						<div className="flex items-center gap-2 text-muted-foreground text-xs">
							<tile.icon className="size-4" />
							{tile.label}
						</div>
						<p className="mt-2 font-stats font-bold text-2xl text-foreground tabular-nums">
							{tile.value}
						</p>
						<p className="mt-1 text-muted-foreground text-xs">{tile.help}</p>
					</section>
				))}
			</div>

			{/* Earn-Back is learners' money, not the platform's — kept visually
			    separate from the take so the two are never read as one pot. */}
			<div className="grid gap-3 sm:grid-cols-2">
				<EarnBackTile
					label={t("admin_earnings.escrowed", {
						defaultValue: "Earn-Back held",
					})}
					value={money(summary.earnBackEscrowed)}
					help={t("admin_earnings.escrowed_help", {
						defaultValue:
							"Owed back to learners who finish in time — not platform revenue.",
					})}
				/>
				<EarnBackTile
					label={t("admin_earnings.refunded", {
						defaultValue: "Earn-Back refunded",
					})}
					value={money(summary.earnBackRefunded)}
					help={t("admin_earnings.refunded_help", {
						defaultValue: "Already returned to learners who earned it back.",
					})}
				/>
			</div>
		</>
	);
}

function EarnBackTile({
	label,
	value,
	help,
}: {
	label: string;
	value: string;
	help: string;
}) {
	return (
		<section className="rounded-card border border-border bg-muted/30 p-4">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="mt-1 font-stats font-semibold text-foreground text-lg tabular-nums">
				{value}
			</p>
			<p className="mt-0.5 text-muted-foreground text-xs">{help}</p>
		</section>
	);
}

function EntityBreakdown({
	rows,
	currency,
}: {
	rows: PlatformEarningsRow[];
	currency: string;
}) {
	const { t } = useTranslation("authoring");
	const money = (n: number) => formatMoney(currency, n);
	const top = rows[0]?.grossVolume ?? 0;

	if (rows.length === 0) {
		return (
			<section className="rounded-card border border-border bg-card p-8 text-center shadow-card">
				<p className="font-display text-foreground">
					{t("admin_earnings.empty_title", { defaultValue: "No sales yet" })}
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					{t("admin_earnings.empty_body", {
						defaultValue:
							"Once paid content sells, the breakdown by course, path and cohort appears here.",
					})}
				</p>
			</section>
		);
	}

	return (
		<section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
			<h3 className="border-border border-b px-4 py-3 font-display text-foreground sm:px-5">
				{t("admin_earnings.by_entity", { defaultValue: "Where it came from" })}
			</h3>

			{/* Desktop: a table. Mobile: the same rows as cards. */}
			<div className="hidden overflow-x-auto sm:block">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-border border-b bg-muted/50 text-left text-muted-foreground text-xs">
							<th className="px-5 py-2.5 font-medium">
								{t("admin_earnings.col_content", { defaultValue: "Content" })}
							</th>
							<th className="px-3 py-2.5 text-right font-medium">
								{t("admin_earnings.col_orders", { defaultValue: "Orders" })}
							</th>
							<th className="px-3 py-2.5 text-right font-medium">
								{t("admin_earnings.col_gross", { defaultValue: "Gross" })}
							</th>
							<th className="px-3 py-2.5 text-right font-medium">
								{t("admin_earnings.col_fee", { defaultValue: "Fee" })}
							</th>
							<th className="px-5 py-2.5 text-right font-medium">
								{t("admin_earnings.col_take", { defaultValue: "Take" })}
							</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr
								key={`${row.entityType}:${row.entityId}`}
								className="border-border/60 border-b last:border-b-0"
							>
								<td className="px-5 py-3">
									<span className="block truncate font-medium text-foreground">
										{row.entityTitle ??
											t("admin_earnings.untitled", {
												defaultValue: "Untitled",
											})}
									</span>
									<span className="mt-1 flex items-center gap-2">
										<TypeBadge type={row.entityType} />
										{/* Share of the top seller — a bar reads faster than a % */}
										<span className="h-1 w-24 overflow-hidden rounded-full bg-muted">
											<span
												className="block h-full rounded-full bg-brand-primary"
												style={{
													width: `${top > 0 ? Math.max(2, (row.grossVolume / top) * 100) : 0}%`,
												}}
											/>
										</span>
									</span>
								</td>
								<td className="px-3 py-3 text-right font-stats text-muted-foreground tabular-nums">
									{row.orderCount}
								</td>
								<td className="px-3 py-3 text-right font-stats text-foreground tabular-nums">
									{money(row.grossVolume)}
								</td>
								<td className="px-3 py-3 text-right font-stats text-muted-foreground tabular-nums">
									{money(row.platformFee)}
								</td>
								<td className="px-5 py-3 text-right font-stats font-semibold text-brand-primary tabular-nums">
									{money(row.platformTake)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<ul className="divide-y divide-border sm:hidden">
				{rows.map((row) => (
					<li key={`${row.entityType}:${row.entityId}`} className="p-4">
						<div className="flex items-start justify-between gap-3">
							<span className="min-w-0">
								<span className="block truncate font-medium text-foreground text-sm">
									{row.entityTitle ??
										t("admin_earnings.untitled", { defaultValue: "Untitled" })}
								</span>
								<TypeBadge type={row.entityType} />
							</span>
							<span className="shrink-0 text-right">
								<span className="block font-stats font-semibold text-brand-primary tabular-nums">
									{money(row.platformTake)}
								</span>
								<span className="block text-muted-foreground text-xs">
									{t("admin_earnings.col_take", { defaultValue: "Take" })}
								</span>
							</span>
						</div>
						<dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
							<Cell
								label={t("admin_earnings.col_orders", {
									defaultValue: "Orders",
								})}
								value={String(row.orderCount)}
							/>
							<Cell
								label={t("admin_earnings.col_gross", { defaultValue: "Gross" })}
								value={money(row.grossVolume)}
							/>
							<Cell
								label={t("admin_earnings.col_fee", { defaultValue: "Fee" })}
								value={money(row.platformFee)}
							/>
						</dl>
					</li>
				))}
			</ul>
		</section>
	);
}

function Cell({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="font-stats text-foreground tabular-nums">{value}</dd>
		</div>
	);
}

function TypeBadge({ type }: { type: string | null }) {
	const { t } = useTranslation("authoring");
	if (!type) return null;
	return (
		<span className="inline-block rounded-pill bg-muted px-2 py-0.5 text-[0.65rem] text-muted-foreground capitalize">
			{t(`admin_earnings.type.${type}`, { defaultValue: type })}
		</span>
	);
}
