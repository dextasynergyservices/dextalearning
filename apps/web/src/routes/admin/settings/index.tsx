import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, CreditCard, Loader2, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { StudioShell } from "@/components/authoring/studio-shell";
import { Skeleton } from "@/components/ui/skeleton";
import {
	adminSettingsKeys,
	getPaymentSettings,
	type PaymentProviderName,
	type PaymentSettingKey,
	type PaymentSettingsResponse,
	type SettingBound,
	updatePaymentProviders,
	updatePaymentSetting,
} from "@/lib/admin-settings-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/settings/")({
	component: AdminSettingsPage,
});

/** Display metadata per setting: label, help, and the unit suffix. */
const META: Record<
	PaymentSettingKey,
	{ label: string; help: string; suffix: string }
> = {
	platform_fee_pct: {
		label: "Platform fee",
		help: "Non-refundable fee taken off the top of every paid sale. Funds the platform; learners can never earn it back.",
		suffix: "%",
	},
	instructor_revenue_share_pct: {
		label: "Instructor revenue share",
		help: "The instructor's cut of settled revenue (after the platform fee). The platform keeps the rest.",
		suffix: "%",
	},
	earn_back_max_duration_days: {
		label: "Earn-Back max window",
		help: "The longest deadline a creator can set. Capped at 85 days in code to stay inside the gateway refund window.",
		suffix: " days",
	},
	default_earn_back_percentage: {
		label: "Default Earn-Back %",
		help: "The percentage applied when a creator turns Earn-Back on without choosing a value.",
		suffix: "%",
	},
};

function AdminSettingsPage() {
	const { t } = useTranslation("authoring");
	const { data, isPending } = useQuery({
		queryKey: adminSettingsKeys.payments,
		queryFn: getPaymentSettings,
	});

	return (
		<StudioShell
			title={t("admin_settings.title", { defaultValue: "Settings" })}
			area="admin"
		>
			<div className="space-y-6">
				<div>
					<h2 className="flex items-center gap-2 font-display text-2xl text-foreground sm:text-3xl">
						<SlidersHorizontal className="size-6 text-brand-primary" />
						{t("admin_settings.payments_title", {
							defaultValue: "Payment settings",
						})}
					</h2>
					<p className="mt-1 text-muted-foreground">
						{t("admin_settings.subtitle", {
							defaultValue:
								"The money rules for the whole platform. Changes apply to new orders only — in-flight enrolments keep the terms they were bought under.",
						})}
					</p>
				</div>

				{isPending ? (
					<div className="space-y-3">
						<Skeleton className="h-28 rounded-card" />
						<Skeleton className="h-28 rounded-card" />
					</div>
				) : (
					<>
						<div className="grid gap-3 sm:grid-cols-2">
							{(data?.settings ?? []).map((s) => (
								<SettingCard key={s.key} setting={s} />
							))}
						</div>
						{data ? (
							<PaymentMethodsCard
								enabled={data.providers}
								all={data.allProviders}
							/>
						) : null}
					</>
				)}
			</div>
		</StudioShell>
	);
}

/** What each provider is, in the terms an Admin thinks about them. */
const PROVIDER_META: Record<
	PaymentProviderName,
	{ label: string; help: string }
> = {
	paystack: {
		label: "Paystack",
		help: "Cards, bank transfer and USSD. The default for NGN, GHS, ZAR and KES.",
	},
	stripe: {
		label: "Stripe",
		help: "Cards and wallets. The default for every other currency.",
	},
};

/**
 * Which payment methods learners are offered at checkout (§14.1). At least one
 * must stay on — the last switch is disabled rather than allowed to take every
 * paid checkout offline.
 */
function PaymentMethodsCard({
	enabled,
	all,
}: {
	enabled: PaymentProviderName[];
	all: PaymentProviderName[];
}) {
	const { t } = useTranslation("authoring");
	const qc = useQueryClient();

	const save = useMutation({
		mutationFn: (providers: PaymentProviderName[]) =>
			updatePaymentProviders(providers),
		onSuccess: ({ providers }) => {
			qc.setQueryData(
				adminSettingsKeys.payments,
				(prev: PaymentSettingsResponse | undefined) =>
					prev ? { ...prev, providers } : prev,
			);
			toast.success(t("admin_settings.saved", { defaultValue: "Saved" }));
		},
		onError: (e) => toast.error(e.message),
	});

	const toggle = (provider: PaymentProviderName) => {
		const on = enabled.includes(provider);
		if (on && enabled.length === 1) return; // never switch the last one off
		save.mutate(
			on ? enabled.filter((p) => p !== provider) : [...enabled, provider],
		);
	};

	return (
		<section className="rounded-card border border-border bg-card p-5 shadow-card">
			<div className="flex items-baseline justify-between gap-2">
				<h3 className="flex items-center gap-2 font-display text-foreground">
					<CreditCard className="size-4 text-brand-primary" />
					{t("admin_settings.methods_title", {
						defaultValue: "Payment methods",
					})}
				</h3>
				{save.isPending ? (
					<Loader2 className="size-4 animate-spin text-muted-foreground" />
				) : null}
			</div>
			<p className="mt-1 text-muted-foreground text-sm">
				{t("admin_settings.methods_help", {
					defaultValue:
						"Which methods learners can pay with. Switching one off takes it out of checkout immediately — keep at least one on.",
				})}
			</p>
			<div className="mt-4 space-y-2">
				{all.map((provider) => {
					const on = enabled.includes(provider);
					const isLast = on && enabled.length === 1;
					const meta = PROVIDER_META[provider];
					return (
						<button
							key={provider}
							type="button"
							onClick={() => toggle(provider)}
							disabled={isLast || save.isPending}
							aria-pressed={on}
							className="flex w-full items-center justify-between gap-3 rounded-btn border border-border p-3 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:hover:bg-transparent"
						>
							<span className="min-w-0">
								<span className="block font-medium text-foreground text-sm">
									{meta.label}
								</span>
								<span className="block text-muted-foreground text-xs">
									{isLast
										? t("admin_settings.methods_last", {
												defaultValue:
													"Your only payment method — switch another on first.",
											})
										: t(`admin_settings.methods_provider.${provider}`, {
												defaultValue: meta.help,
											})}
								</span>
							</span>
							<span
								className={cn(
									"relative h-6 w-11 shrink-0 rounded-full transition-colors",
									on ? "bg-brand-solid" : "bg-slate-300 dark:bg-slate-600",
									isLast && "opacity-60",
								)}
							>
								<span
									className={cn(
										"absolute top-0.5 size-5 rounded-full bg-card shadow-sm transition-all",
										on ? "left-[1.375rem]" : "left-0.5",
									)}
								/>
							</span>
						</button>
					);
				})}
			</div>
		</section>
	);
}

function SettingCard({ setting }: { setting: SettingBound }) {
	const { t } = useTranslation("authoring");
	const qc = useQueryClient();
	const meta = META[setting.key];
	const [value, setValue] = useState(String(setting.value));

	// Keep the input in step if the server value changes (e.g. after a save).
	useEffect(() => {
		setValue(String(setting.value));
	}, [setting.value]);

	const save = useMutation({
		mutationFn: () => updatePaymentSetting(setting.key, Number(value)),
		onSuccess: ({ settings }) => {
			qc.setQueryData(adminSettingsKeys.payments, { settings });
			toast.success(t("admin_settings.saved", { defaultValue: "Saved" }));
		},
		onError: (e) => toast.error(e.message),
	});

	const num = Number(value);
	const valid =
		value !== "" &&
		Number.isInteger(num) &&
		num >= setting.min &&
		num <= setting.max;
	const dirty = num !== setting.value;

	return (
		<section className="rounded-card border border-border bg-card p-5 shadow-card">
			<div className="flex items-baseline justify-between gap-2">
				<h3 className="font-display text-foreground">
					{t(`admin_settings.label.${setting.key}`, {
						defaultValue: meta.label,
					})}
				</h3>
				<span className="font-stats text-muted-foreground text-xs">
					{setting.min}–{setting.max}
					{meta.suffix}
				</span>
			</div>
			<p className="mt-1 text-muted-foreground text-sm">
				{t(`admin_settings.help.${setting.key}`, { defaultValue: meta.help })}
			</p>
			<div className="mt-4 flex items-center gap-2">
				<div className="relative flex-1">
					<input
						type="number"
						min={setting.min}
						max={setting.max}
						value={value}
						onChange={(e) => setValue(e.target.value)}
						className="h-11 w-full rounded-btn border border-border bg-background px-3 pr-12 font-stats text-foreground tabular-nums outline-none focus:border-brand-primary"
					/>
					<span className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground text-sm">
						{meta.suffix.trim()}
					</span>
				</div>
				<button
					type="button"
					onClick={() => save.mutate()}
					disabled={!valid || !dirty || save.isPending}
					className="flex h-11 items-center gap-1.5 rounded-btn bg-brand-solid px-4 font-semibold text-sm text-white transition-colors hover:bg-brand-solid-hover disabled:opacity-50"
				>
					{save.isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Check className="size-4" />
					)}
					{t("admin_settings.save", { defaultValue: "Save" })}
				</button>
			</div>
		</section>
	);
}
