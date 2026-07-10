import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
	BadgeCheck,
	Loader2,
	MessageCircle,
	Smartphone,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { ApiError } from "@/lib/api";
import {
	sendPhoneCode,
	type VerificationChannel,
	verifyPhoneCode,
} from "@/lib/phone-verification-api";
import { cn } from "@/lib/utils";

interface PhoneVerifyDialogProps {
	open: boolean;
	/** The saved phone number being verified (display + backend target). */
	phone: string;
	onOpenChange: (open: boolean) => void;
	/** Called after the number is confirmed, so the parent can refetch. */
	onVerified: () => void;
}

type Stage = "choose" | "code" | "done";

/**
 * Verify ownership of the learner's phone via a WhatsApp/SMS one-time code.
 * Mobile: a drag-to-dismiss bottom sheet (native-app feel). Desktop: a centered
 * modal. Three stages — pick a channel, enter the code, celebrate.
 */
export function PhoneVerifyDialog({
	open,
	phone,
	onOpenChange,
	onVerified,
}: PhoneVerifyDialogProps) {
	const { t } = useTranslation();
	const [stage, setStage] = useState<Stage>("choose");
	const [channel, setChannel] = useState<VerificationChannel>("whatsapp");
	const [code, setCode] = useState("");
	const [cooldown, setCooldown] = useState(0);
	const [error, setError] = useState<string | null>(null);

	// Reset to a clean slate whenever the dialog (re)opens.
	useEffect(() => {
		if (open) {
			setStage("choose");
			setCode("");
			setCooldown(0);
			setError(null);
		}
	}, [open]);

	// Resend countdown tick.
	useEffect(() => {
		if (cooldown <= 0) return;
		const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
		return () => clearInterval(id);
	}, [cooldown]);

	const send = useMutation({
		mutationFn: (ch: VerificationChannel) => sendPhoneCode(ch),
		onSuccess: (res, ch) => {
			setChannel(ch);
			setCode("");
			setError(null);
			setStage("code");
			setCooldown(res.resendInSeconds ?? 60);
		},
		onError: (err) =>
			setError(
				err instanceof ApiError
					? err.message
					: t("phoneVerify.genericError", {
							defaultValue: "We couldn't send the code. Please try again.",
						}),
			),
	});

	const verify = useMutation({
		mutationFn: (value: string) => verifyPhoneCode(value),
		onSuccess: () => {
			setError(null);
			setStage("done");
		},
		onError: (err) =>
			setError(err instanceof ApiError ? err.message : String(err)),
	});

	const submitCode = (value: string) => {
		if (value.length === 6 && !verify.isPending) verify.mutate(value);
	};

	const panelBody = (
		<div className="p-5 sm:p-6">
			<div className="flex items-start justify-between gap-3">
				<h2 className="font-display text-foreground text-lg">
					{stage === "done"
						? t("phoneVerify.verifiedTitle", {
								defaultValue: "Number verified",
							})
						: t("phoneVerify.title", { defaultValue: "Verify your number" })}
				</h2>
				<button
					type="button"
					aria-label={t("phoneVerify.close", { defaultValue: "Close" })}
					onClick={() => onOpenChange(false)}
					className="flex size-9 shrink-0 items-center justify-center rounded-btn text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				>
					<X className="size-4" />
				</button>
			</div>

			{stage === "choose" ? (
				<div className="mt-4 space-y-4">
					<p className="text-muted-foreground text-sm">
						{t("phoneVerify.chooseMethod", {
							phone,
							defaultValue: "How should we send your code to {{phone}}?",
						})}
					</p>
					<div className="space-y-2.5">
						<button
							type="button"
							disabled={send.isPending}
							onClick={() => send.mutate("whatsapp")}
							className="flex w-full items-center gap-3 rounded-card border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-brand-primary hover:bg-accent disabled:opacity-60"
						>
							<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
								{send.isPending && send.variables === "whatsapp" ? (
									<Loader2 className="size-5 animate-spin" />
								) : (
									<MessageCircle className="size-5" />
								)}
							</span>
							<span className="font-medium text-foreground text-sm">
								{t("phoneVerify.sendWhatsapp", {
									defaultValue: "Send code on WhatsApp",
								})}
							</span>
						</button>
						<button
							type="button"
							disabled={send.isPending}
							onClick={() => send.mutate("sms")}
							className="flex w-full items-center gap-3 rounded-card border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-brand-primary hover:bg-accent disabled:opacity-60"
						>
							<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
								{send.isPending && send.variables === "sms" ? (
									<Loader2 className="size-5 animate-spin" />
								) : (
									<Smartphone className="size-5" />
								)}
							</span>
							<span className="font-medium text-foreground text-sm">
								{t("phoneVerify.sendSms", { defaultValue: "Send code by SMS" })}
							</span>
						</button>
					</div>
					{error ? <p className="text-error text-sm">{error}</p> : null}
				</div>
			) : null}

			{stage === "code" ? (
				<div className="mt-4 space-y-4">
					<p className="text-muted-foreground text-sm">
						{t(
							channel === "sms"
								? "phoneVerify.codeSentSms"
								: "phoneVerify.codeSentWhatsapp",
							{
								phone,
								defaultValue: "We sent a code to {{phone}}.",
							},
						)}
					</p>
					<OtpInput
						value={code}
						onChange={(v) => {
							setCode(v);
							setError(null);
						}}
						onComplete={submitCode}
						autoFocus
						invalid={Boolean(error)}
						ariaLabel={t("phoneVerify.enterCode", {
							defaultValue: "Enter the 6-digit code",
						})}
					/>
					{error ? (
						<p className="text-center text-error text-sm">{error}</p>
					) : null}
					<Button
						className="w-full"
						disabled={code.length !== 6 || verify.isPending}
						onClick={() => submitCode(code)}
					>
						{verify.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : null}
						{verify.isPending
							? t("phoneVerify.verifying", { defaultValue: "Verifying…" })
							: t("phoneVerify.verify", { defaultValue: "Verify" })}
					</Button>
					<div className="flex items-center justify-between text-sm">
						<button
							type="button"
							onClick={() => setStage("choose")}
							className="text-muted-foreground transition-colors hover:text-foreground"
						>
							{t("phoneVerify.changeMethod", {
								defaultValue: "Use a different method",
							})}
						</button>
						<button
							type="button"
							disabled={cooldown > 0 || send.isPending}
							onClick={() => send.mutate(channel)}
							className="font-medium text-brand-primary transition-colors hover:text-brand-primary/80 disabled:text-muted-foreground"
						>
							{cooldown > 0
								? t("phoneVerify.resendIn", {
										seconds: cooldown,
										defaultValue: "Resend in {{seconds}}s",
									})
								: t("phoneVerify.resend", { defaultValue: "Resend code" })}
						</button>
					</div>
				</div>
			) : null}

			{stage === "done" ? (
				<div className="mt-4 flex flex-col items-center gap-4 py-2 text-center">
					<motion.span
						initial={{ scale: 0 }}
						animate={{ scale: 1 }}
						transition={{ type: "spring", stiffness: 260, damping: 22 }}
						className="flex size-16 items-center justify-center rounded-full bg-success/10 text-success"
					>
						<BadgeCheck className="size-8" />
					</motion.span>
					<p className="text-muted-foreground text-sm">
						{t("phoneVerify.verifiedBody", {
							defaultValue: "Thanks! Your phone number is now verified.",
						})}
					</p>
					<Button
						className="w-full"
						onClick={() => {
							onVerified();
							onOpenChange(false);
						}}
					>
						{t("phoneVerify.done", { defaultValue: "Done" })}
					</Button>
				</div>
			) : null}
		</div>
	);

	return (
		<AnimatePresence>
			{open ? (
				<div
					className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4"
					role="presentation"
				>
					<motion.button
						type="button"
						aria-label={t("phoneVerify.close", { defaultValue: "Close" })}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={() => onOpenChange(false)}
						className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
					/>
					<motion.section
						aria-modal="true"
						aria-label={t("phoneVerify.title", {
							defaultValue: "Verify your number",
						})}
						role="dialog"
						drag="y"
						dragConstraints={{ top: 0, bottom: 0 }}
						dragElastic={{ top: 0, bottom: 0.6 }}
						onDragEnd={(_, info) => {
							if (info.offset.y > 80 || info.velocity.y > 600) {
								onOpenChange(false);
							}
						}}
						initial={{ y: "100%", opacity: 0.6 }}
						animate={{ y: 0, opacity: 1 }}
						exit={{ y: "100%", opacity: 0.6 }}
						transition={{ type: "spring", stiffness: 380, damping: 38 }}
						className={cn(
							"relative w-full touch-pan-y rounded-t-card border-border border-t bg-popover pb-[env(safe-area-inset-bottom)] shadow-card-hover",
							"sm:max-w-md sm:rounded-card sm:border sm:pb-0",
						)}
					>
						<div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30 sm:hidden" />
						{panelBody}
					</motion.section>
				</div>
			) : null}
		</AnimatePresence>
	);
}
