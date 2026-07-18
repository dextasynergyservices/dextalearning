import { AnimatePresence, motion } from "framer-motion";
import {
	Check,
	Copy,
	KeyRound,
	Loader2,
	ShieldCheck,
	ShieldOff,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { OtpInput } from "@/components/ui/otp-input";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

interface TwoFactorSectionProps {
	/** Current 2FA state from the session/user record. */
	enabled: boolean;
	/** Called after enable/disable so the parent can refetch the session. */
	onChanged: () => void;
}

type Flow = "idle" | "password" | "setup" | "backup";
type Intent = "enable" | "disable" | "regenerate";

/**
 * §5.9 Layer 6 — TOTP two-step verification settings. Enable walks the user
 * through: confirm password → scan the QR (or copy the manual key) → confirm a
 * 6-digit code → save backup codes. The QR renderer (`qrcode`) is lazy-imported
 * so it never weighs down the main bundle (§13.2).
 */
export function TwoFactorSection({
	enabled,
	onChanged,
}: TwoFactorSectionProps) {
	const { t } = useTranslation("auth");
	const pwId = useId();
	const [flow, setFlow] = useState<Flow>("idle");
	const [intent, setIntent] = useState<Intent>("enable");
	const [password, setPassword] = useState("");
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState(false);
	const [totpUri, setTotpUri] = useState<string | null>(null);
	const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
	const [backupCodes, setBackupCodes] = useState<string[]>([]);
	const [copied, setCopied] = useState(false);

	// Render the otpauth:// URI to a QR image, lazily. Kept out of the entry
	// chunk — only pulled when the setup step actually shows.
	useEffect(() => {
		if (!totpUri) {
			setQrDataUrl(null);
			return;
		}
		let alive = true;
		void import("qrcode").then((qr) =>
			qr.toDataURL(totpUri, { margin: 1, width: 220 }).then(
				(url) => alive && setQrDataUrl(url),
				() => alive && setQrDataUrl(null),
			),
		);
		return () => {
			alive = false;
		};
	}, [totpUri]);

	const reset = () => {
		setFlow("idle");
		setPassword("");
		setCode("");
		setTotpUri(null);
		setQrDataUrl(null);
		setBackupCodes([]);
		setCopied(false);
	};

	const manualKey = totpUri
		? (new URL(totpUri).searchParams.get("secret") ?? "")
		: "";

	const openPassword = (next: Intent) => {
		setIntent(next);
		setPassword("");
		setFlow("password");
	};

	const submitPassword = async () => {
		if (busy) return;
		if (!password) {
			toast.error(t("twofa.password_required"));
			return;
		}
		setBusy(true);
		try {
			if (intent === "disable") {
				const { error } = await authClient.twoFactor.disable({ password });
				if (error) throw new Error(error.message ?? undefined);
				toast.success(t("twofa.disabled_toast"));
				reset();
				onChanged();
				return;
			}
			if (intent === "regenerate") {
				const { data, error } = await authClient.twoFactor.generateBackupCodes({
					password,
				});
				if (error) throw new Error(error.message ?? undefined);
				setBackupCodes(data?.backupCodes ?? []);
				setFlow("backup");
				toast.success(t("twofa.regenerated_toast"));
				return;
			}
			// enable → returns the TOTP URI + fresh backup codes; not active until
			// the user confirms a code (verifyTotp) in the setup step.
			const { data, error } = await authClient.twoFactor.enable({ password });
			if (error) throw new Error(error.message ?? undefined);
			setTotpUri(data?.totpURI ?? null);
			setBackupCodes(data?.backupCodes ?? []);
			setCode("");
			setFlow("setup");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : t("twofa.generic_error"),
			);
		} finally {
			setBusy(false);
		}
	};

	const confirmEnable = async () => {
		if (busy || code.length < 6) return;
		setBusy(true);
		try {
			const { error } = await authClient.twoFactor.verifyTotp({ code });
			if (error) throw new Error(error.message ?? undefined);
			// Confirmed — move to the backup-codes handoff, then celebrate.
			setFlow("backup");
			onChanged();
		} catch {
			toast.error(t("twofa.invalid"));
			setCode("");
		} finally {
			setBusy(false);
		}
	};

	const copyCodes = async () => {
		try {
			await navigator.clipboard.writeText(backupCodes.join("\n"));
			setCopied(true);
			toast.success(t("twofa.copied"));
			setTimeout(() => setCopied(false), 2000);
		} catch {
			/* clipboard unavailable — codes are on screen to copy manually */
		}
	};

	return (
		<div className="p-5 sm:p-6">
			<div className="flex items-start gap-3">
				<span
					className={cn(
						"flex size-10 shrink-0 items-center justify-center rounded-full",
						enabled
							? "bg-success/10 text-success"
							: "bg-muted text-muted-foreground",
					)}
				>
					{enabled ? (
						<ShieldCheck className="size-5" />
					) : (
						<ShieldOff className="size-5" />
					)}
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<h3 className="font-medium text-foreground">
							{t("twofa.heading")}
						</h3>
						<span
							className={cn(
								"rounded-full px-2 py-0.5 font-stats text-xs",
								enabled
									? "bg-success/10 text-success"
									: "bg-muted text-muted-foreground",
							)}
						>
							{enabled ? t("twofa.status_on") : t("twofa.status_off")}
						</span>
					</div>
					<p className="mt-1 text-muted-foreground text-sm">
						{t("twofa.description")}
					</p>

					{enabled ? (
						<div className="mt-3 flex flex-wrap gap-3">
							<button
								type="button"
								onClick={() => openPassword("disable")}
								className="font-medium text-error text-sm hover:underline"
							>
								{t("twofa.disable")}
							</button>
							<button
								type="button"
								onClick={() => openPassword("regenerate")}
								className="font-medium text-brand-primary text-sm hover:underline"
							>
								{t("twofa.regenerate")}
							</button>
						</div>
					) : (
						<button
							type="button"
							onClick={() => openPassword("enable")}
							className="mt-3 inline-flex items-center gap-2 rounded-btn bg-brand-solid px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-brand-primary/90"
						>
							<ShieldCheck className="size-4" />
							{t("twofa.enable")}
						</button>
					)}
				</div>
			</div>

			<AnimatePresence>
				{flow !== "idle" ? (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
						transition={{ duration: 0.2 }}
						className="overflow-hidden"
					>
						<div className="mt-4 rounded-card border border-border bg-background p-4">
							{flow === "password" ? (
								<div className="space-y-3">
									<label
										htmlFor={pwId}
										className="block font-medium text-foreground text-sm"
									>
										{t("twofa.password_label")}
									</label>
									<p className="text-muted-foreground text-xs">
										{t("twofa.password_prompt")}
									</p>
									<input
										id={pwId}
										type="password"
										autoComplete="current-password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && submitPassword()}
										className="h-11 w-full rounded-input border border-border bg-card px-4 text-foreground outline-none focus:border-brand-primary"
									/>
									<div className="flex gap-2">
										<button
											type="button"
											onClick={submitPassword}
											disabled={busy}
											className="inline-flex items-center gap-2 rounded-btn bg-brand-solid px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-60"
										>
											{busy ? (
												<Loader2 className="size-4 animate-spin" />
											) : null}
											{intent === "disable"
												? t("twofa.disable")
												: t("twofa.enable")}
										</button>
										<button
											type="button"
											onClick={reset}
											className="rounded-btn px-4 py-2 font-medium text-muted-foreground text-sm hover:bg-accent"
										>
											{t("twofa.cancel")}
										</button>
									</div>
								</div>
							) : null}

							{flow === "setup" ? (
								<div className="space-y-4">
									<p className="font-medium text-foreground text-sm">
										{t("twofa.scan_title")}
									</p>
									<div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
										{qrDataUrl ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img
												src={qrDataUrl}
												alt={t("twofa.scan_title")}
												width={180}
												height={180}
												className="rounded-card border border-border bg-white p-2"
											/>
										) : (
											<div className="flex size-[180px] items-center justify-center rounded-card border border-border">
												<Loader2 className="size-5 animate-spin text-muted-foreground" />
											</div>
										)}
										<div className="min-w-0 flex-1 space-y-2">
											<p className="text-muted-foreground text-xs">
												{t("twofa.scan_hint")}
											</p>
											{manualKey ? (
												<code className="block break-all rounded-input border border-border bg-card px-3 py-2 font-stats text-foreground text-xs">
													{manualKey}
												</code>
											) : null}
										</div>
									</div>
									<div className="space-y-2">
										<p className="font-medium text-foreground text-sm">
											{t("twofa.code_label")}
										</p>
										<OtpInput
											value={code}
											onChange={setCode}
											onComplete={confirmEnable}
											ariaLabel={t("twofa.code_label")}
										/>
									</div>
									<div className="flex gap-2">
										<button
											type="button"
											onClick={confirmEnable}
											disabled={busy || code.length < 6}
											className="inline-flex items-center gap-2 rounded-btn bg-brand-solid px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-60"
										>
											{busy ? (
												<Loader2 className="size-4 animate-spin" />
											) : null}
											{t("twofa.confirm_enable")}
										</button>
										<button
											type="button"
											onClick={reset}
											className="rounded-btn px-4 py-2 font-medium text-muted-foreground text-sm hover:bg-accent"
										>
											{t("twofa.cancel")}
										</button>
									</div>
								</div>
							) : null}

							{flow === "backup" ? (
								<div className="space-y-3">
									<div className="flex items-center gap-2">
										<KeyRound className="size-4 text-brand-primary" />
										<p className="font-medium text-foreground text-sm">
											{t("twofa.backup_title")}
										</p>
									</div>
									<p className="text-muted-foreground text-xs">
										{t("twofa.backup_hint")}
									</p>
									<div className="grid grid-cols-2 gap-2 rounded-input border border-border bg-card p-3 font-stats text-foreground text-sm">
										{backupCodes.map((c) => (
											<span key={c} className="tracking-widest">
												{c}
											</span>
										))}
									</div>
									<div className="flex gap-2">
										<button
											type="button"
											onClick={copyCodes}
											className="inline-flex items-center gap-2 rounded-btn border border-border px-4 py-2 font-medium text-foreground text-sm hover:bg-accent"
										>
											{copied ? (
												<Check className="size-4 text-success" />
											) : (
												<Copy className="size-4" />
											)}
											{copied ? t("twofa.copied") : t("twofa.copy")}
										</button>
										<button
											type="button"
											onClick={() => {
												reset();
												onChanged();
											}}
											className="inline-flex items-center gap-2 rounded-btn bg-brand-solid px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-brand-primary/90"
										>
											{t("twofa.done")}
										</button>
									</div>
								</div>
							) : null}
						</div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
}
