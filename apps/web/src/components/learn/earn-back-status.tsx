import { useQuery } from "@tanstack/react-query";
import {
	CheckCircle2,
	Clock,
	Loader2,
	Sparkles,
	TriangleAlert,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EnrollableType } from "@/lib/content-api";
import { formatMoney } from "@/lib/content-api";
import { getEarnBackStatus } from "@/lib/payments-api";
import { cn } from "@/lib/utils";
import { EarnBackDeadlinePicker } from "./earn-back-deadline-picker";

/**
 * Learner Earn-Back status (§4.11) on a course/path/cohort progress page. Shows
 * the live deadline countdown + refundable amount while escrowed (reinforcing
 * the commitment device), then the refund outcome once resolved. Renders
 * nothing for free / non-earn-back content.
 */
export function EarnBackStatus({
	type,
	entityId,
}: {
	type: EnrollableType;
	entityId: string;
}) {
	const { t, i18n } = useTranslation("authoring");
	const { data } = useQuery({
		queryKey: ["earn-back-status", type, entityId],
		queryFn: () => getEarnBackStatus(type, entityId),
		// While the refund is in flight the worker settles it within seconds, so
		// poll — the "this page updates on its own" promise has to be true.
		refetchInterval: (q) =>
			q.state.data?.outcome === "pending" ? 5_000 : false,
	});
	if (!data) return null;

	const money = (n: number) => formatMoney(data.currency, n);

	if (data.phase === "resolved") {
		if (data.outcome === "processed") {
			return (
				<Card tone="success" icon={Sparkles}>
					<p className="font-display text-foreground">
						{t("earnback_status.refunded_title", {
							defaultValue: "Earn-Back on its way! 🎉",
						})}
					</p>
					<p className="mt-0.5 text-muted-foreground text-sm">
						{t("earnback_status.refunded_body", {
							defaultValue:
								"{{amount}} is being refunded to your original payment method.",
							amount: money(data.refundAmount ?? 0),
						})}
					</p>
					{/* Say WHEN. Without it the learner watches their bank for money we
					    already sent, and reads silence as a lost refund. */}
					<p className="mt-1.5 text-muted-foreground text-xs">
						{t("earnback_status.refunded_eta", {
							defaultValue:
								"Refunds usually land within 5–10 business days, depending on your bank. Nothing else to do.",
						})}
					</p>
					{data.refundedAt ? (
						<p className="mt-1 text-muted-foreground text-xs">
							{t("earnback_status.refunded_on", {
								defaultValue: "Sent {{date}}",
								date: new Date(data.refundedAt).toLocaleDateString(
									i18n.language,
									{ day: "numeric", month: "short", year: "numeric" },
								),
							})}
						</p>
					) : null}
				</Card>
			);
		}
		// Queued, gateway not yet acknowledged. This used to fall through to
		// "No Earn-Back remaining" — telling a learner owed money they get none.
		if (data.outcome === "pending") {
			return (
				<Card tone="brand" icon={Loader2} spin>
					<p className="font-display text-foreground">
						{t("earnback_status.sending_title", {
							defaultValue: "Sending your Earn-Back…",
						})}
					</p>
					<p className="mt-0.5 text-muted-foreground text-sm">
						{t("earnback_status.sending_body", {
							defaultValue:
								"You earned {{amount}} back. We're sending it to your original payment method now — this page updates on its own.",
							amount: money(data.refundAmount ?? 0),
						})}
					</p>
				</Card>
			);
		}
		if (data.outcome === "failed") {
			return (
				<Card tone="warning" icon={TriangleAlert}>
					<p className="font-display text-foreground">
						{t("earnback_status.failed_title", {
							defaultValue: "We're processing your Earn-Back",
						})}
					</p>
					<p className="mt-0.5 text-muted-foreground text-sm">
						{t("earnback_status.failed_body", {
							defaultValue:
								"Your {{amount}} isn't lost — our team is on it and will be in touch. There's nothing you need to do.",
							amount: money(data.refundAmount ?? 0),
						})}
					</p>
				</Card>
			);
		}
		return (
			<Card tone="muted" icon={CheckCircle2}>
				<p className="font-display text-foreground">
					{t("earnback_status.none_title", {
						defaultValue: "Course complete",
					})}
				</p>
				<p className="mt-0.5 text-muted-foreground text-sm">
					{t("earnback_status.none_body", {
						defaultValue: "No Earn-Back remaining on this one.",
					})}
				</p>
			</Card>
		);
	}

	// The creator left the window open, so it's the learner's call (§4.11.1).
	// Ask here too — they may have skipped the prompt right after paying.
	if (data.canSetDeadline && data.maxDays) {
		return (
			<EarnBackDeadlinePicker
				type={type}
				entityId={entityId}
				maxDays={data.maxDays}
				base={data.base}
				currency={data.currency}
			/>
		);
	}

	// Escrowed — awaiting completion. Show the countdown.
	const daysLeft = data.deadline
		? Math.ceil(
				(new Date(data.deadline).getTime() - Date.now()) /
					(24 * 60 * 60 * 1000),
			)
		: null;
	const overdue = daysLeft !== null && daysLeft < 0;

	return (
		<Card tone={overdue ? "warning" : "brand"} icon={Clock}>
			<p className="font-display text-foreground">
				{t("earnback_status.escrow_title", {
					defaultValue: "Earn back {{amount}}",
					amount: money(data.base),
				})}
			</p>
			<p className="mt-0.5 text-muted-foreground text-sm">
				{daysLeft === null
					? t("earnback_status.escrow_body_nodate", {
							defaultValue:
								"Complete everything to get your Earn-Back refunded.",
						})
					: overdue
						? t("earnback_status.escrow_overdue", {
								defaultValue:
									"Past your deadline — finish soon; a small daily amount is deducted now.",
							})
						: t("earnback_status.escrow_body", {
								defaultValue:
									"Finish within {{count}} days to get the full refund to your payment method.",
								count: daysLeft,
							})}
			</p>
			{/* Whose deadline this is — the learner should never wonder where the
			    date came from, or think they can move it. */}
			{data.deadline ? (
				<p className="mt-1.5 text-muted-foreground text-xs">
					{data.deadlineSource === "learner"
						? t("earnback_status.deadline_yours", {
								defaultValue:
									"Your deadline: {{date}} — set by you, and final.",
								date: new Date(data.deadline).toLocaleDateString(
									i18n.language,
									{
										day: "numeric",
										month: "short",
										year: "numeric",
									},
								),
							})
						: t("earnback_status.deadline_creator", {
								defaultValue: "Deadline: {{date}} — set by the creator.",
								date: new Date(data.deadline).toLocaleDateString(
									i18n.language,
									{
										day: "numeric",
										month: "short",
										year: "numeric",
									},
								),
							})}
				</p>
			) : null}
		</Card>
	);
}

function Card({
	tone,
	icon: Icon,
	spin,
	children,
}: {
	tone: "brand" | "success" | "warning" | "muted";
	icon: typeof Clock;
	spin?: boolean;
	children: React.ReactNode;
}) {
	const toneCls = {
		brand:
			"border-brand-primary/25 bg-brand-primary-light/30 text-brand-primary",
		success: "border-success/30 bg-success/5 text-success",
		warning:
			"border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400",
		muted: "border-border bg-muted/40 text-muted-foreground",
	}[tone];
	return (
		<section
			className={cn(
				"flex items-start gap-3 rounded-card border p-4 shadow-card",
				toneCls,
			)}
		>
			<span className="mt-0.5 shrink-0">
				{/* motion-safe: a permanent spinner is exactly what reduced-motion
				    users ask us not to do (§13). */}
				<Icon className={cn("size-5", spin && "motion-safe:animate-spin")} />
			</span>
			<div className="min-w-0 flex-1">{children}</div>
		</section>
	);
}
