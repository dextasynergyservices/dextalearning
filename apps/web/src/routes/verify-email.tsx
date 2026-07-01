import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/auth-layout";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { type VerifyValues, verifySchema } from "@/lib/auth-schemas";

export const Route = createFileRoute("/verify-email")({
	validateSearch: (search: Record<string, unknown>): { email?: string } => ({
		email: typeof search.email === "string" ? search.email : undefined,
	}),
	component: VerifyEmailPage,
});

function VerifyEmailPage() {
	const { t } = useTranslation("auth");
	const { email } = Route.useSearch();
	const navigate = useNavigate();
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<VerifyValues>({ resolver: zodResolver(verifySchema) });

	const onSubmit = async (values: VerifyValues) => {
		await authClient.emailOtp.verifyEmail(
			{
				email: email ?? "",
				otp: values.code,
			},
			{
				onSuccess: () => {
					toast.success(t("toasts.verified"));
					navigate({ to: "/onboarding" });
				},
				onError: (ctx) => {
					toast.error(ctx.error.message || t("toasts.error"));
				},
			},
		);
	};

	const resend = async () => {
		await authClient.emailOtp.sendVerificationOtp(
			{
				email: email ?? "",
				type: "email-verification",
			},
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
			title={t("verify.title")}
			subtitle={t("verify.subtitle", { email: email ?? "" })}
		>
			<form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
				<FormField
					label={t("verify.code")}
					inputMode="numeric"
					autoComplete="one-time-code"
					maxLength={6}
					placeholder="● ● ● ● ● ●"
					className="text-center text-lg tracking-[0.4em]"
					error={errors.code?.message}
					{...register("code")}
				/>
				<Button
					type="submit"
					size="lg"
					disabled={isSubmitting}
					className="w-full"
				>
					{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
					{t("verify.submit")}
				</Button>
			</form>
			<div className="mt-5 flex items-center justify-between text-sm">
				<button
					type="button"
					onClick={resend}
					className="font-medium text-brand-primary hover:underline"
				>
					{t("verify.resend")}
				</button>
				<Link to="/register" className="text-muted-foreground hover:underline">
					{t("verify.change_email")}
				</Link>
			</div>
		</AuthLayout>
	);
}
