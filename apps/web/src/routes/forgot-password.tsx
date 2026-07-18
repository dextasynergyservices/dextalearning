import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/auth-layout";
import { FormField } from "@/components/auth/form-field";
import {
	TurnstileWidget,
	turnstileEnabled,
} from "@/components/auth/turnstile-widget";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { type ForgotValues, forgotSchema } from "@/lib/auth-schemas";

export const Route = createFileRoute("/forgot-password")({
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const { t } = useTranslation("auth");
	const navigate = useNavigate();
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) });

	const onSubmit = async (values: ForgotValues) => {
		if (turnstileEnabled() && !turnstileToken) {
			toast.error(t("security.turnstile_wait"));
			return;
		}
		// Email-OTP reset (the only reset method this Better Auth client exposes):
		// sends a 6-digit code, then /reset-password collects the code + new
		// password together in one step.
		await authClient.forgetPassword.emailOtp(
			{ email: values.email },
			{
				// §5.9 Layer 2 — Turnstile token as a header (the API middleware reads
				// it there so it never consumes Better Auth's raw body).
				...(turnstileToken
					? { headers: { "x-turnstile-token": turnstileToken } }
					: {}),
				onSuccess: () => {
					toast.success(t("toasts.reset_sent"));
					navigate({ to: "/reset-password", search: { email: values.email } });
				},
				onError: (ctx) => {
					toast.error(ctx.error.message || t("toasts.error"));
				},
			},
		);
	};

	return (
		<AuthLayout title={t("forgot.title")} subtitle={t("forgot.subtitle")}>
			<form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
				<FormField
					label={t("forgot.email")}
					type="email"
					autoComplete="email"
					error={errors.email?.message}
					{...register("email")}
				/>
				<TurnstileWidget onToken={setTurnstileToken} />
				<Button
					type="submit"
					size="lg"
					disabled={isSubmitting}
					className="w-full"
				>
					{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
					{t("forgot.submit")}
				</Button>
			</form>
			<p className="mt-5 text-center">
				<Link
					to="/login"
					className="font-medium text-brand-primary text-sm hover:underline"
				>
					{t("forgot.back_to_login")}
				</Link>
			</p>
		</AuthLayout>
	);
}
