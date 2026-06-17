import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AuthDivider } from "@/components/auth/auth-divider";
import { AuthLayout } from "@/components/auth/auth-layout";
import { FormField } from "@/components/auth/form-field";
import { GoogleButton } from "@/components/auth/google-button";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { registerAccount } from "@/lib/api";
import { signInWithGoogle } from "@/lib/auth-client";
import { type RegisterValues, registerSchema } from "@/lib/auth-schemas";

export const Route = createFileRoute("/register")({ component: RegisterPage });

function RegisterPage() {
	const { t } = useTranslation("auth");
	const navigate = useNavigate();
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<RegisterValues>({
		resolver: zodResolver(registerSchema),
		mode: "onBlur",
	});

	const onSubmit = async (values: RegisterValues) => {
		try {
			await registerAccount({
				firstName: values.firstName,
				lastName: values.lastName,
				otherNames: values.otherNames || undefined,
				email: values.email,
				phone: values.phone || undefined,
				password: values.password,
				confirmPassword: values.confirmPassword,
			});
			toast.success(t("toasts.registered"));
			navigate({ to: "/verify-email", search: { email: values.email } });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t("toasts.error"));
		}
	};

	return (
		<AuthLayout title={t("register.title")} subtitle={t("register.subtitle")}>
			<GoogleButton
				label={t("register.google")}
				onClick={() => signInWithGoogle()}
			/>
			<AuthDivider />
			<form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
				<div className="grid grid-cols-2 gap-3">
					<FormField
						label={t("register.first_name")}
						autoComplete="given-name"
						error={errors.firstName?.message}
						{...register("firstName")}
					/>
					<FormField
						label={t("register.last_name")}
						autoComplete="family-name"
						error={errors.lastName?.message}
						{...register("lastName")}
					/>
				</div>
				<FormField
					label={t("register.other_names")}
					autoComplete="additional-name"
					error={errors.otherNames?.message}
					{...register("otherNames")}
				/>
				<FormField
					label={t("register.email")}
					type="email"
					autoComplete="email"
					error={errors.email?.message}
					{...register("email")}
				/>
				<FormField
					label={t("register.phone")}
					type="tel"
					autoComplete="tel"
					hint={t("register.phone_hint")}
					error={errors.phone?.message}
					{...register("phone")}
				/>
				<PasswordField
					label={t("register.password")}
					autoComplete="new-password"
					hint={t("password_rules")}
					error={errors.password?.message}
					{...register("password")}
				/>
				<PasswordField
					label={t("register.confirm_password")}
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
					{t("register.submit")}
				</Button>
			</form>
			<p className="mt-5 text-center text-slate-500 text-sm">
				{t("register.have_account")}{" "}
				<Link
					to="/login"
					className="font-semibold text-brand-primary hover:underline"
				>
					{t("register.sign_in")}
				</Link>
			</p>
			<p className="mt-4 text-center text-slate-400 text-xs">
				{t("register.terms")}
			</p>
		</AuthLayout>
	);
}
