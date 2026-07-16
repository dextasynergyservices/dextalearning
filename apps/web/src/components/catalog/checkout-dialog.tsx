import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
	PaymentMethodPicker,
	providerLabels,
} from "@/components/catalog/payment-method-picker";
import { Button } from "@/components/ui/button";
import type { EnrollableType } from "@/lib/content-api";
import { formatMoney } from "@/lib/content-api";
import {
	getEarnBackWindow,
	getPaymentMethods,
	getPlatformFeePct,
	type PaymentProviderName,
	startCheckout,
} from "@/lib/payments-api";

export interface CheckoutCommercials {
	title: string;
	price: number;
	currency: string;
	isFree: boolean;
	isEarnBackEligible: boolean;
	earnBackPercentage: number | null;
	earnBackDeadlineDays: number | null;
}

/**
 * Checkout disclosure (§4.11 checkout-disclosure UI). Before sending the learner
 * to the gateway it makes the Earn-Back deal explicit: what settles now
 * (non-refundable) vs the refundable Earn-Back base and its deadline — so the
 * commitment is understood before payment. "Proceed" opens the hosted checkout.
 */
export function CheckoutDialog({
	open,
	onOpenChange,
	type,
	id,
	commercials,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	type: EnrollableType;
	id: string;
	commercials: CheckoutCommercials;
}) {
	const { t } = useTranslation("academy");
	const [provider, setProvider] = useState<PaymentProviderName | null>(null);

	const checkout = useMutation({
		mutationFn: () => startCheckout(type, id, provider ?? undefined),
		onSuccess: ({ authorizationUrl }) => {
			window.location.href = authorizationUrl;
		},
		onError: (e) => toast.error(e.message),
	});

	const { data: fee } = useQuery({
		queryKey: ["platform-fee"],
		queryFn: getPlatformFeePct,
		staleTime: 5 * 60_000,
	});

	// Only needed to say "up to N days" when the creator left the window open.
	// NB: not named `window` — this component redirects via `window.location`.
	const { data: earnBackWindow } = useQuery({
		queryKey: ["earn-back-window"],
		queryFn: getEarnBackWindow,
		enabled: open && commercials.earnBackDeadlineDays == null,
		staleTime: 5 * 60_000,
	});

	// Which methods Admin offers, and which one the server would pick for this
	// currency — asked only while the dialog is open (§14.1).
	const { data: methods } = useQuery({
		queryKey: ["payment-methods", commercials.currency],
		queryFn: () => getPaymentMethods(commercials.currency),
		enabled: open,
		staleTime: 5 * 60_000,
	});

	// Preselect the server's recommendation; the learner can override it.
	useEffect(() => {
		if (provider === null && methods?.recommended) {
			setProvider(methods.recommended);
		}
	}, [methods?.recommended, provider]);

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !checkout.isPending) onOpenChange(false);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [checkout.isPending, onOpenChange, open]);

	if (!open) return null;

	const { price, currency, isEarnBackEligible, earnBackPercentage } =
		commercials;
	// Platform fee comes off the top; earn-back applies to the remainder (§2).
	const feePct = fee?.pct ?? 0;
	const feeAmount = Math.round(((price * feePct) / 100) * 100) / 100;
	const remainder = Math.round((price - feeAmount) * 100) / 100;
	const pct = isEarnBackEligible ? (earnBackPercentage ?? 100) : 0;
	const refundable = Math.round(((remainder * pct) / 100) * 100) / 100;
	const guaranteed = Math.round((remainder - refundable) * 100) / 100;
	// The creator's window, or null when they left it to the learner (§4.11.1) —
	// in which case we quote the platform ceiling as "up to N days" rather than
	// inventing a number the learner is never actually held to.
	const creatorDays = commercials.earnBackDeadlineDays;
	const maxDays = earnBackWindow?.maxDays ?? 60;

	return (
		<div
			className="fixed inset-0 z-50 flex items-end justify-center px-3 py-4 sm:items-center"
			role="presentation"
		>
			<button
				type="button"
				aria-label={t("checkout.close", { defaultValue: "Close" })}
				disabled={checkout.isPending}
				onClick={() => onOpenChange(false)}
				className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
			/>
			<section
				aria-labelledby="checkout-title"
				aria-modal="true"
				role="dialog"
				className="relative w-full max-w-md rounded-card border border-border bg-popover p-5 shadow-[0_20px_60px_rgba(15,23,42,0.18)]"
			>
				<div className="flex items-start justify-between gap-3">
					<h2
						id="checkout-title"
						className="font-display text-foreground text-lg"
					>
						{t("checkout.title", { defaultValue: "Confirm enrolment" })}
					</h2>
					<button
						type="button"
						aria-label={t("checkout.close", { defaultValue: "Close" })}
						disabled={checkout.isPending}
						onClick={() => onOpenChange(false)}
						className="flex size-8 shrink-0 items-center justify-center rounded-btn text-muted-foreground hover:bg-accent hover:text-foreground"
					>
						<X className="size-4" />
					</button>
				</div>

				<p className="mt-1 truncate text-muted-foreground text-sm">
					{commercials.title}
				</p>

				<div className="mt-4 space-y-2 rounded-card border border-border bg-card p-4">
					<Row
						label={t("checkout.total", { defaultValue: "You pay today" })}
						value={formatMoney(currency, price)}
						strong
					/>
					{feeAmount > 0 ? (
						<Row
							label={t("checkout.platform_fee", {
								defaultValue: "Platform fee ({{pct}}%) · non-refundable",
								pct: feePct,
							})}
							value={formatMoney(currency, feeAmount)}
						/>
					) : null}
					{isEarnBackEligible ? (
						<>
							<Row
								label={t("checkout.refundable", {
									defaultValue: "Refundable Earn-Back",
								})}
								value={formatMoney(currency, refundable)}
								tone="success"
							/>
							<Row
								label={t("checkout.guaranteed", {
									defaultValue: "Non-refundable",
								})}
								value={formatMoney(currency, guaranteed)}
							/>
						</>
					) : null}
				</div>

				{isEarnBackEligible ? (
					<div className="mt-3 flex items-start gap-2 rounded-card bg-brand-primary-light/50 p-3 text-brand-primary text-sm">
						<Sparkles className="mt-0.5 size-4 shrink-0" />
						<p>
							{creatorDays != null
								? t("checkout.earnback_hint", {
										defaultValue:
											"Finish within {{days}} days and we send the refundable {{amount}} back to your card. Finish late and a small daily amount is kept.",
										days: creatorDays,
										amount: formatMoney(currency, refundable),
									})
								: t("checkout.earnback_hint_learner_deadline", {
										defaultValue:
											"You'll set your own deadline — up to {{max}} days — right after payment. Finish by it and we send the refundable {{amount}} back to your card.",
										max: maxDays,
										amount: formatMoney(currency, refundable),
									})}
						</p>
					</div>
				) : null}

				<PaymentMethodPicker
					providers={methods?.providers ?? []}
					value={provider}
					onChange={setProvider}
					disabled={checkout.isPending}
				/>

				<Button
					variant="primary"
					onClick={() => checkout.mutate()}
					disabled={checkout.isPending}
					className="mt-5 w-full"
				>
					{checkout.isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<ShieldCheck className="size-4" />
					)}
					{t("checkout.proceed", { defaultValue: "Proceed to payment" })}
				</Button>
				<p className="mt-2 text-center text-muted-foreground text-xs">
					{t("checkout.secure", {
						defaultValue: "Secure payment via {{providers}}",
						providers: methods?.providers.length
							? providerLabels(methods.providers)
							: "Paystack / Stripe",
					})}
				</p>
			</section>
		</div>
	);
}

function Row({
	label,
	value,
	strong,
	tone,
}: {
	label: string;
	value: string;
	strong?: boolean;
	tone?: "success";
}) {
	return (
		<div className="flex items-center justify-between gap-3 text-sm">
			<span className="text-muted-foreground">{label}</span>
			<span
				className={
					tone === "success"
						? "font-semibold text-success tabular-nums"
						: strong
							? "font-bold text-foreground tabular-nums"
							: "text-foreground tabular-nums"
				}
			>
				{value}
			</span>
		</div>
	);
}
