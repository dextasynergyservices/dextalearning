import { createFileRoute } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { authClient, homeForRole } from "@/lib/auth-client";

export const Route = createFileRoute("/2fa")({
	component: TwoFactorChallenge,
});

/**
 * Second-factor challenge (§5.9). Reached when Better Auth answers a password
 * login with `twoFactorRedirect` (see auth-client.ts). The user enters their
 * authenticator's 6-digit code, or falls back to a one-time backup code.
 */
function TwoFactorChallenge() {
	const { t } = useTranslation("auth");
	const [code, setCode] = useState("");
	const [useBackup, setUseBackup] = useState(false);
	const [busy, setBusy] = useState(false);

	const submit = async () => {
		if (busy) return;
		setBusy(true);
		try {
			const { error } = useBackup
				? await authClient.twoFactor.verifyBackupCode({ code })
				: await authClient.twoFactor.verifyTotp({ code });
			if (error) {
				toast.error(
					error.message ??
						t("twofa.invalid", { defaultValue: "That code didn't work." }),
				);
				return;
			}
			// Session is now fully authenticated — hard-navigate so the landing
			// loads with the completed session (mirrors login.tsx's rationale).
			const fresh = await authClient.getSession();
			const role = (fresh.data?.user as { role?: string } | undefined)?.role;
			window.location.href = homeForRole(role);
		} finally {
			setBusy(false);
		}
	};

	return (
		<AuthLayout
			title={t("twofa.title", { defaultValue: "Two-step verification" })}
			subtitle={
				useBackup
					? t("twofa.subtitle_backup", {
							defaultValue: "Enter one of your saved backup codes.",
						})
					: t("twofa.subtitle", {
							defaultValue:
								"Enter the 6-digit code from your authenticator app.",
						})
			}
		>
			<div className="flex flex-col items-center gap-6">
				<span className="flex size-14 items-center justify-center rounded-full bg-brand-primary-light text-brand-primary">
					<ShieldCheck className="size-7" />
				</span>

				{useBackup ? (
					<input
						value={code}
						onChange={(e) => setCode(e.target.value.trim())}
						autoComplete="one-time-code"
						placeholder={t("twofa.backup_placeholder", {
							defaultValue: "Backup code",
						})}
						className="h-12 w-full max-w-xs rounded-input border border-border bg-card px-4 text-center font-stats text-foreground tracking-widest outline-none focus:border-brand-primary"
						onKeyDown={(e) => e.key === "Enter" && submit()}
					/>
				) : (
					<OtpInput value={code} onChange={setCode} onComplete={submit} />
				)}

				<Button
					size="lg"
					onClick={submit}
					disabled={busy || code.length < 6}
					className="w-full"
				>
					{busy ? <Loader2 className="size-4 animate-spin" /> : null}
					{t("twofa.verify", { defaultValue: "Verify" })}
				</Button>

				<button
					type="button"
					onClick={() => {
						setUseBackup((v) => !v);
						setCode("");
					}}
					className="text-brand-primary text-sm hover:underline"
				>
					{useBackup
						? t("twofa.use_app", {
								defaultValue: "Use your authenticator app instead",
							})
						: t("twofa.use_backup", {
								defaultValue: "Use a backup code instead",
							})}
				</button>
			</div>
		</AuthLayout>
	);
}
