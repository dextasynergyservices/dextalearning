import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Landmark,
	Loader2,
	Plus,
	ShieldCheck,
	Star,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Combobox } from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import {
	addPaystackAccount,
	deletePayoutAccount,
	earningsKeys,
	getBanks,
	getPayoutAccounts,
	type PayoutAccount,
	setDefaultAccount,
} from "@/lib/earnings-api";
import { cn } from "@/lib/utils";

/**
 * Instructor payout accounts (§14.3): list every account, choose which is the
 * default payout target, remove accounts, and add a new one via a searchable
 * bank picker + verified account resolution. Native-app feel: large tap
 * targets, a type-to-filter bank combobox, inline verification.
 */
export function PayoutAccounts() {
	const { t } = useTranslation("authoring");
	const qc = useQueryClient();
	const [adding, setAdding] = useState(false);
	const { data, isPending } = useQuery({
		queryKey: earningsKeys.accounts,
		queryFn: getPayoutAccounts,
	});

	const setDefault = useMutation({
		mutationFn: (id: string) => setDefaultAccount(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: earningsKeys.accounts }),
		onError: (e) => toast.error(e.message),
	});
	const remove = useMutation({
		mutationFn: (id: string) => deletePayoutAccount(id),
		onSuccess: () => {
			toast.success(t("earnings.account_removed", { defaultValue: "Removed" }));
			qc.invalidateQueries({ queryKey: earningsKeys.accounts });
		},
		onError: (e) => toast.error(e.message),
	});

	if (isPending) return <Skeleton className="h-40 rounded-card" />;
	const accounts = data?.accounts ?? [];

	return (
		<section className="rounded-card border border-border bg-card p-5 shadow-card">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<Landmark className="size-5 text-brand-primary" />
					<h3 className="font-display text-foreground">
						{t("earnings.payout_accounts", {
							defaultValue: "Payout accounts",
						})}
					</h3>
				</div>
				{accounts.length > 0 && !adding ? (
					<button
						type="button"
						onClick={() => setAdding(true)}
						className="inline-flex h-9 items-center gap-1.5 rounded-btn border border-border px-3 font-medium text-foreground text-sm transition-colors hover:border-brand-primary"
					>
						<Plus className="size-4" />
						{t("earnings.add_account", { defaultValue: "Add" })}
					</button>
				) : null}
			</div>

			{accounts.length === 0 && !adding ? (
				<p className="mt-2 text-muted-foreground text-sm">
					{t("earnings.no_accounts", {
						defaultValue:
							"Add the bank account where you'd like to receive your earnings. Until one is verified, payouts wait safely as pending.",
					})}
				</p>
			) : null}

			{accounts.length > 0 ? (
				<ul className="mt-4 space-y-2">
					{accounts.map((acct) => (
						<AccountRow
							key={acct.id}
							account={acct}
							onMakeDefault={() => setDefault.mutate(acct.id)}
							onRemove={() => remove.mutate(acct.id)}
							busy={setDefault.isPending || remove.isPending}
						/>
					))}
				</ul>
			) : null}

			{accounts.length === 0 || adding ? (
				<div
					className={cn(
						accounts.length > 0 && "mt-4 border-border border-t pt-4",
					)}
				>
					<AddAccountForm
						onDone={() => {
							setAdding(false);
							qc.invalidateQueries({ queryKey: earningsKeys.accounts });
						}}
						onCancel={accounts.length > 0 ? () => setAdding(false) : undefined}
					/>
				</div>
			) : null}
		</section>
	);
}

function AccountRow({
	account,
	onMakeDefault,
	onRemove,
	busy,
}: {
	account: PayoutAccount;
	onMakeDefault: () => void;
	onRemove: () => void;
	busy: boolean;
}) {
	const { t } = useTranslation("authoring");
	return (
		<li className="flex items-center gap-3 rounded-card border border-border bg-background p-3.5">
			<span
				className={cn(
					"flex size-10 shrink-0 items-center justify-center rounded-btn",
					account.isDefault
						? "bg-success/15 text-success"
						: "bg-muted text-muted-foreground",
				)}
			>
				{account.isDefault ? (
					<ShieldCheck className="size-5" />
				) : (
					<Landmark className="size-5" />
				)}
			</span>
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium text-foreground text-sm">
					{account.accountName ?? account.label ?? account.provider}
				</p>
				<p className="truncate text-muted-foreground text-xs">
					{account.bankName ? `${account.bankName} · ` : ""}
					{account.last4 ? `••••${account.last4}` : account.provider}
				</p>
			</div>
			{account.isDefault ? (
				<span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-success/15 px-2.5 py-1 font-medium text-success text-xs">
					<Star className="size-3 fill-current" />
					{t("earnings.default", { defaultValue: "Default" })}
				</span>
			) : (
				<button
					type="button"
					onClick={onMakeDefault}
					disabled={busy}
					className="shrink-0 rounded-pill border border-border px-2.5 py-1 font-medium text-foreground text-xs transition-colors hover:border-brand-primary disabled:opacity-50"
				>
					{t("earnings.make_default", { defaultValue: "Make default" })}
				</button>
			)}
			<button
				type="button"
				onClick={onRemove}
				disabled={busy}
				aria-label={t("earnings.remove", { defaultValue: "Remove" })}
				className="flex size-8 shrink-0 items-center justify-center rounded-btn text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
			>
				<Trash2 className="size-4" />
			</button>
		</li>
	);
}

function AddAccountForm({
	onDone,
	onCancel,
}: {
	onDone: () => void;
	onCancel?: () => void;
}) {
	const { t } = useTranslation("authoring");
	const [bankCode, setBankCode] = useState("");
	const [accountNumber, setAccountNumber] = useState("");

	const { data: banksData } = useQuery({
		queryKey: earningsKeys.banks,
		queryFn: getBanks,
	});
	const bankOptions = useMemo(
		() =>
			(banksData?.banks ?? []).map((b) => ({ value: b.code, label: b.name })),
		[banksData],
	);

	const save = useMutation({
		mutationFn: () => addPaystackAccount({ bankCode, accountNumber }),
		onSuccess: () => {
			toast.success(
				t("earnings.account_saved", { defaultValue: "Account verified" }),
			);
			onDone();
		},
		onError: (e) =>
			toast.error(
				e instanceof ApiError
					? e.message
					: t("earnings.account_error", {
							defaultValue: "We couldn't verify that account",
						}),
			),
	});

	const canSubmit = bankCode !== "" && /^\d{10}$/.test(accountNumber);

	return (
		<form
			className="space-y-3"
			onSubmit={(e) => {
				e.preventDefault();
				if (canSubmit) save.mutate();
			}}
		>
			<div>
				<span className="mb-1 block font-medium text-foreground text-sm">
					{t("earnings.bank", { defaultValue: "Bank" })}
				</span>
				<Combobox
					options={bankOptions}
					value={bankCode || null}
					onChange={setBankCode}
					placeholder={t("earnings.bank_placeholder", {
						defaultValue: "Select your bank",
					})}
					searchPlaceholder={t("earnings.search_bank", {
						defaultValue: "Search banks…",
					})}
					emptyText={t("earnings.no_banks", {
						defaultValue: "No banks match",
					})}
				/>
			</div>
			<label className="block">
				<span className="mb-1 block font-medium text-foreground text-sm">
					{t("earnings.account_number", { defaultValue: "Account number" })}
				</span>
				<input
					inputMode="numeric"
					maxLength={10}
					value={accountNumber}
					onChange={(e) =>
						setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
					}
					placeholder="0123456789"
					className="h-11 w-full rounded-btn border border-border bg-background px-3 text-foreground text-sm tabular-nums"
				/>
			</label>
			<div className="flex gap-2">
				{onCancel ? (
					<button
						type="button"
						onClick={onCancel}
						className="h-11 flex-1 rounded-btn border border-border font-medium text-foreground text-sm"
					>
						{t("earnings.cancel", { defaultValue: "Cancel" })}
					</button>
				) : null}
				<button
					type="submit"
					disabled={!canSubmit || save.isPending}
					className="flex h-11 flex-1 items-center justify-center gap-2 rounded-btn bg-brand-solid font-semibold text-sm text-white transition-colors hover:bg-brand-solid-hover disabled:opacity-50"
				>
					{save.isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<ShieldCheck className="size-4" />
					)}
					{t("earnings.verify_save", { defaultValue: "Verify & save" })}
				</button>
			</div>
		</form>
	);
}
