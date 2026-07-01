import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Info, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AuthDivider } from "@/components/auth/auth-divider";
import { AuthLayout } from "@/components/auth/auth-layout";
import { FormField } from "@/components/auth/form-field";
import { GoogleButton } from "@/components/auth/google-button";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { ApiError, registerAccount } from "@/lib/api";
import { signInWithGoogle } from "@/lib/auth-client";
import { type RegisterValues, registerSchema } from "@/lib/auth-schemas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/register")({
	component: RegisterPage,
	validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
		redirect: typeof search.redirect === "string" ? search.redirect : undefined,
	}),
});

function RegisterPage() {
	const { t } = useTranslation("auth");
	const navigate = useNavigate();
	const { redirect } = Route.useSearch();
	const {
		register,
		handleSubmit,
		setValue,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<RegisterValues>({
		resolver: zodResolver(registerSchema),
		mode: "onBlur",
		defaultValues: { role: "learner" },
	});
	const role = watch("role");
	const [existingEmail, setExistingEmail] = useState<string | null>(null);

	const onSubmit = async (values: RegisterValues) => {
		setExistingEmail(null);
		try {
			await registerAccount({
				firstName: values.firstName,
				lastName: values.lastName,
				otherNames: values.otherNames || undefined,
				email: values.email,
				phone: values.phone || undefined,
				password: values.password,
				confirmPassword: values.confirmPassword,
				role: values.role,
			});
			toast.success(t("toasts.registered"));
			navigate({ to: "/verify-email", search: { email: values.email } });
		} catch (error) {
			// Existing account → a clear, actionable nudge to sign in (not a toast).
			if (error instanceof ApiError && error.code === "EMAIL_EXISTS") {
				setExistingEmail(values.email);
				return;
			}
			toast.error(error instanceof Error ? error.message : t("toasts.error"));
		}
	};

	return (
		<AuthLayout title={t("register.title")} subtitle={t("register.subtitle")}>
			{existingEmail ? (
				<div className="mb-5 flex items-start gap-3 rounded-card border border-brand-primary/30 bg-brand-primary-light p-4">
					<Info className="mt-0.5 size-5 shrink-0 text-brand-primary" />
					<div className="min-w-0 text-sm">
						<p className="font-semibold text-foreground">
							{t("register.exists_title", {
								defaultValue: "This email already has an account",
							})}
						</p>
						<p className="mt-0.5 text-muted-foreground">
							{t("register.exists_body", {
								defaultValue: "{{email}} is already registered.",
								email: existingEmail,
							})}
						</p>
						<Link
							to="/login"
							search={{ redirect }}
							className="mt-2 inline-block font-semibold text-brand-primary hover:underline"
						>
							{t("register.exists_cta", { defaultValue: "Sign in instead →" })}
						</Link>
					</div>
				</div>
			) : null}
			<GoogleButton
				label={t("register.google")}
				onClick={() => signInWithGoogle()}
			/>
			<AuthDivider />
			<form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
				<div>
					<span className="mb-1.5 block font-medium text-foreground text-sm">
						{t("register.join_as", { defaultValue: "Join as" })}
					</span>
					<div className="grid grid-cols-2 gap-2">
						{(["learner", "instructor"] as const).map((r) => (
							<button
								key={r}
								type="button"
								onClick={() => setValue("role", r, { shouldValidate: true })}
								className={cn(
									"rounded-btn border px-3 py-2.5 text-sm transition-colors",
									role === r
										? "border-brand-primary bg-brand-primary/10 font-medium text-brand-primary"
										: "border-border text-muted-foreground hover:border-border",
								)}
							>
								{t(`register.role_${r}`, {
									defaultValue: r === "learner" ? "Learner" : "Instructor",
								})}
							</button>
						))}
					</div>
					<p className="mt-1.5 text-muted-foreground text-xs">
						{role === "instructor"
							? t("register.role_instructor_hint", {
									defaultValue:
										"Create and sell courses, paths and assessments.",
								})
							: t("register.role_learner_hint", {
									defaultValue:
										"Take courses, earn certificates and Earn-Back.",
								})}
					</p>
				</div>
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
			<p className="mt-5 text-center text-muted-foreground text-sm">
				{t("register.have_account")}{" "}
				<Link
					to="/login"
					search={{ redirect }}
					className="font-semibold text-brand-primary hover:underline"
				>
					{t("register.sign_in")}
				</Link>
			</p>
			<p className="mt-4 text-center text-muted-foreground text-xs">
				{t("register.terms")}
			</p>
		</AuthLayout>
	);
}
