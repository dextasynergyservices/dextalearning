import { Check, CreditCard, Landmark } from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import type { PaymentProviderName } from "@/lib/payments-api";
import { cn } from "@/lib/utils";

/** What each provider means to a learner — the methods, not the brand. */
const META: Record<
	PaymentProviderName,
	{ icon: ComponentType<{ className?: string }>; label: string; help: string }
> = {
	paystack: {
		icon: Landmark,
		label: "Paystack",
		help: "Card, bank transfer or USSD",
	},
	stripe: {
		icon: CreditCard,
		label: "Stripe",
		help: "Card or wallet",
	},
};

/**
 * How the learner wants to pay (§14.1). Only shown when Admin offers more than
 * one method — with a single method there is no choice to make, so asking would
 * be noise. The selection is a *preference*: the server ignores anything Admin
 * doesn't currently offer.
 */
export function PaymentMethodPicker({
	providers,
	value,
	onChange,
	disabled,
}: {
	providers: PaymentProviderName[];
	value: PaymentProviderName | null;
	onChange: (provider: PaymentProviderName) => void;
	disabled?: boolean;
}) {
	const { t } = useTranslation("academy");
	if (providers.length < 2) return null;

	return (
		<fieldset className="mt-4" disabled={disabled}>
			<legend className="mb-1.5 font-medium text-foreground text-sm">
				{t("checkout.method", { defaultValue: "How would you like to pay?" })}
			</legend>
			<div className="grid grid-cols-2 gap-2">
				{providers.map((provider) => {
					const meta = META[provider];
					const on = value === provider;
					return (
						<button
							key={provider}
							type="button"
							onClick={() => onChange(provider)}
							disabled={disabled}
							aria-pressed={on}
							className={cn(
								"flex items-start gap-2 rounded-btn border p-3 text-left transition-colors disabled:opacity-60",
								on
									? "border-brand-primary bg-brand-primary/5"
									: "border-border hover:bg-accent",
							)}
						>
							<meta.icon
								className={cn(
									"mt-0.5 size-4 shrink-0",
									on ? "text-brand-primary" : "text-muted-foreground",
								)}
							/>
							<span className="min-w-0 flex-1">
								<span
									className={cn(
										"block font-medium text-sm",
										on ? "text-brand-primary" : "text-foreground",
									)}
								>
									{meta.label}
								</span>
								<span className="block text-muted-foreground text-xs">
									{t(`checkout.method_help.${provider}`, {
										defaultValue: meta.help,
									})}
								</span>
							</span>
							{on ? (
								<Check className="mt-0.5 size-4 shrink-0 text-brand-primary" />
							) : null}
						</button>
					);
				})}
			</div>
		</fieldset>
	);
}

/** The provider names to credit in the checkout footer — only what's offered. */
export function providerLabels(providers: PaymentProviderName[]): string {
	return providers.map((p) => META[p].label).join(" / ");
}
