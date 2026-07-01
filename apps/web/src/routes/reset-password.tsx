import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/auth-layout";
import { FormField } from "@/components/auth/form-field";
import { PasswordField } from "@/components/auth/password-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import {
	type ResetPasswordValues,
	resetPasswordSchema,
} from "@/lib/auth-schemas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reset-password")({
	// Carried over from /forgot-password once the OTP has been requested.
	validateSearch: (search: Record<string, unknown>): { email?: string } => ({
		email: typeof search.email === "string" ? search.email : undefined,
	}),
	component: ResetPasswordPage,
});

function ResetPasswordPage() {
	const { t } = useTranslation("auth");
	const { email } = Route.useSearch();
	const navigate = useNavigate();
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<ResetPasswordValues>({
		resolver: zodResolver(resetPasswordSchema),
	});

	// Reached directly (no email carried over) → send them to request a code first.
	if (!email) {
		return (
			<AuthLayout
				title={t("reset.invalid_title", {
					defaultValue: "Request a reset code first",
				})}
				subtitle={t("reset.invalid_body", {
					defaultValue:
						"Enter your email on the previous screen and we'll send you a 6-digit code.",
				})}
			>
				<div className="flex justify-center py-2">
					<Link
						to="/forgot-password"
						className={cn(buttonVariants({ variant: "outline", size: "md" }))}
					>
						{t("reset.request_new", { defaultValue: "Request a code" })}
					</Link>
				</div>
			</AuthLayout>
		);
	}

	const onSubmit = async (values: ResetPasswordValues) => {
		await authClient.emailOtp.resetPassword(
			{ email, otp: values.code, password: values.password },
			{
				onSuccess: () => {
					toast.success(
						t("reset.success", {
							defaultValue:
								"Password updated — sign in with your new password.",
						}),
					);
					navigate({ to: "/login" });
				},
				onError: (ctx) => {
					toast.error(ctx.error.message || t("toasts.error"));
				},
			},
		);
	};

	const resend = async () => {
		await authClient.forgetPassword.emailOtp(
			{ email },
			{
				onSuccess: () => {
					toast.success(t("toasts.code_resent"));
				},
				onError: (ctx) => {
					toast.error(ctx.error.message || t("toasts.error"));
				},
			},
		);
	};

	return (
		<AuthLayout
			title={t("reset.title", { defaultValue: "Set a new password" })}
			subtitle={t("reset.subtitle", {
				defaultValue:
					"Enter the code we sent to {{email}}, then choose a new password.",
				email,
			})}
		>
			<form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
				<FormField
					label={t("reset.code", { defaultValue: "Reset code" })}
					inputMode="numeric"
					autoComplete="one-time-code"
					maxLength={6}
					placeholder="● ● ● ● ● ●"
					className="text-center text-lg tracking-[0.4em]"
					error={errors.code?.message}
					{...register("code")}
				/>
				<PasswordField
					label={t("reset.password", { defaultValue: "New password" })}
					autoComplete="new-password"
					error={errors.password?.message}
					{...register("password")}
				/>
				<PasswordField
					label={t("reset.confirm", { defaultValue: "Confirm password" })}
					autoComplete="new-password"
					error={errors.confirmPassword?.message}
					{...register("confirmPassword")}
				/>
				<Button
					type="submit"
					size="lg"
					disabled={isSubmitting}
					className="w-full"
				>
					{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
					{t("reset.submit", { defaultValue: "Update password" })}
				</Button>
			</form>
			<p className="mt-5 text-center">
				<button
					type="button"
					onClick={resend}
					className="font-medium text-brand-primary text-sm hover:underline"
				>
					{t("verify.resend", { defaultValue: "Resend code" })}
				</button>
			</p>
		</AuthLayout>
	);
}
