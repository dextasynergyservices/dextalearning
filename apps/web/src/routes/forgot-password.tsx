import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/auth-layout";
import { FormField } from "@/components/auth/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { type ForgotValues, forgotSchema } from "@/lib/auth-schemas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/forgot-password")({
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const { t } = useTranslation("auth");
	const [sentTo, setSentTo] = useState<string | null>(null);
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) });

	const onSubmit = async (values: ForgotValues) => {
		await authClient.forgetPassword.emailOtp(
			{
				email: values.email,
			},
			{
				onSuccess: () => {
					toast.success(t("toasts.reset_sent"));
					setSentTo(values.email);
				},
				onError: (ctx) => {
					toast.error(ctx.error.message || t("toasts.error"));
				},
			},
		);
	};

	if (sentTo) {
		return (
			<AuthLayout
				title={t("forgot.sent_title")}
				subtitle={t("forgot.sent_body", { email: sentTo })}
			>
				<div className="flex flex-col items-center gap-5 py-4">
					<span className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
						<MailCheck className="size-7" />
					</span>
					<Link
						to="/login"
						className={cn(buttonVariants({ variant: "outline", size: "md" }))}
					>
						{t("forgot.back_to_login")}
					</Link>
				</div>
			</AuthLayout>
		);
	}

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
