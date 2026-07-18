import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EarnBackDeadlinePicker } from "@/components/learn/earn-back-deadline-picker";
import type { EnrollableType } from "@/lib/content-api";
import { getEarnBackStatus, verifyPayment } from "@/lib/payments-api";

export const Route = createFileRoute("/checkout/callback")({
	validateSearch: (search: Record<string, unknown>) => ({
		// Paystack sends `reference` (and a duplicate `trxref`); Stripe uses our
		// `reference`. Accept either so the page confirms regardless of provider.
		reference:
			typeof search.reference === "string"
				? search.reference
				: typeof search.trxref === "string"
					? search.trxref
					: "",
	}),
	component: CheckoutCallbackPage,
});

/**
 * Post-payment landing (§14). Instead of only waiting for the async webhook
 * (which can't reach a local dev server), this VERIFIES the charge directly
 * with the gateway and settles the order, then routes the learner into their
 * new content. Retries a few times while the provider is still "pending".
 */
function CheckoutCallbackPage() {
	const { reference } = Route.useSearch();
	const { t } = useTranslation("academy");

	const { data, isError, refetch, isFetching } = useQuery({
		queryKey: ["verify-payment", reference],
		queryFn: () => verifyPayment(reference),
		enabled: reference !== "",
		retry: false,
		// Keep verifying while the gateway still reports pending (idempotent).
		refetchInterval: (query) => {
			const s = query.state.data?.status;
			return s === "paid" || s === "earn_back_issued" || s === "failed"
				? false
				: 2500;
		},
	});

	const settled =
		data?.status === "paid" || data?.status === "earn_back_issued";
	const failed = data?.status === "failed";

	// The one moment the learner is actually thinking about this purchase — ask
	// for their Earn-Back deadline here, not weeks later (§4.11.1). Only fires
	// when the creator left the window open; otherwise there's nothing to ask.
	const { data: earnBack } = useQuery({
		queryKey: ["earn-back-status", data?.entityType, data?.entityId],
		queryFn: () =>
			getEarnBackStatus(
				data?.entityType as EnrollableType,
				data?.entityId ?? "",
			),
		enabled: settled && !!data?.entityType && !!data?.entityId,
	});
	const needsDeadline = !!earnBack?.canSetDeadline && !!earnBack.maxDays;

	const learnLink = (() => {
		if (!data?.entityType || !data.entityId) return null;
		if (data.entityType === "course") {
			return {
				to: "/learn/course/$courseId",
				params: { courseId: data.entityId },
			} as const;
		}
		if (data.entityType === "path") {
			return {
				to: "/learn/path/$pathId",
				params: { pathId: data.entityId },
			} as const;
		}
		return {
			to: "/learn/cohort/$cohortId",
			params: { cohortId: data.entityId },
		} as const;
	})();

	return (
		<main className="grid min-h-dvh place-items-center bg-muted/40 px-4 py-10">
			{/* Widen when the deadline picker is in play — its options need room to
			    stay tappable on a phone. */}
			<div
				className={`w-full rounded-card border border-border bg-card p-6 text-center shadow-card sm:p-8 ${
					needsDeadline ? "max-w-lg" : "max-w-md"
				}`}
			>
				{reference === "" ? (
					<>
						<Clock className="mx-auto size-12 text-muted-foreground" />
						<h1 className="mt-4 font-display text-foreground text-xl">
							{t("checkout.no_reference", {
								defaultValue: "No payment to confirm",
							})}
						</h1>
						<Link
							to="/"
							className="mt-6 inline-flex text-brand-primary text-sm hover:underline"
						>
							{t("checkout.back_home", { defaultValue: "Back to home" })}
						</Link>
					</>
				) : settled ? (
					<>
						<CheckCircle2 className="mx-auto size-14 text-success" />
						<h1 className="mt-4 font-display text-foreground text-xl">
							{t("checkout.success_title", {
								defaultValue: "You're enrolled! 🎉",
							})}
						</h1>
						<p className="mt-2 text-muted-foreground text-sm">
							{t("checkout.success_body", {
								defaultValue:
									"Your payment is confirmed and {{title}} is ready for you.",
								title: data?.entityTitle ?? "your content",
							})}
						</p>
						{needsDeadline && data?.entityType && data.entityId ? (
							<div className="mt-6 text-left">
								<EarnBackDeadlinePicker
									type={data.entityType}
									entityId={data.entityId}
									maxDays={earnBack?.maxDays ?? 60}
									base={earnBack?.base}
									currency={earnBack?.currency}
								/>
							</div>
						) : null}
						{learnLink ? (
							<Link
								to={learnLink.to}
								params={learnLink.params}
								className={
									needsDeadline
										? "mt-3 inline-flex h-11 w-full items-center justify-center rounded-btn border border-border font-medium text-muted-foreground text-sm transition-colors hover:bg-accent"
										: "mt-6 inline-flex h-11 w-full items-center justify-center rounded-btn bg-brand-solid font-semibold text-sm text-white transition-colors hover:bg-brand-solid-hover"
								}
							>
								{needsDeadline
									? t("checkout.skip_deadline", {
											defaultValue: "Skip for now",
										})
									: t("checkout.start_learning", {
											defaultValue: "Start learning",
										})}
							</Link>
						) : null}
					</>
				) : failed || isError ? (
					<>
						<XCircle className="mx-auto size-14 text-destructive" />
						<h1 className="mt-4 font-display text-foreground text-xl">
							{t("checkout.failed_title", {
								defaultValue: "Payment not completed",
							})}
						</h1>
						<p className="mt-2 text-muted-foreground text-sm">
							{t("checkout.failed_body", {
								defaultValue:
									"We couldn't confirm this payment. If you were charged, it will be reconciled automatically — or try again.",
							})}
						</p>
						<button
							type="button"
							onClick={() => refetch()}
							disabled={isFetching}
							className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-btn border border-border font-medium text-foreground text-sm hover:border-brand-primary"
						>
							{isFetching ? <Loader2 className="size-4 animate-spin" /> : null}
							{t("checkout.recheck", { defaultValue: "Check again" })}
						</button>
						<Link
							to="/"
							className="mt-3 inline-flex text-muted-foreground text-sm hover:underline"
						>
							{t("checkout.back_home", { defaultValue: "Back to home" })}
						</Link>
					</>
				) : (
					<>
						<Loader2 className="mx-auto size-12 animate-spin text-brand-primary" />
						<h1 className="mt-4 font-display text-foreground text-xl">
							{t("checkout.confirming_title", {
								defaultValue: "Confirming your payment…",
							})}
						</h1>
						<p className="mt-2 text-muted-foreground text-sm">
							{t("checkout.confirming_body", {
								defaultValue:
									"This only takes a moment. You'll be enrolled as soon as it clears.",
							})}
						</p>
					</>
				)}
			</div>
		</main>
	);
}
