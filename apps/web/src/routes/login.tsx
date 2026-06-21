import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import {
	authClient,
	homeForRole,
	signIn,
	signInWithGoogle,
} from "@/lib/auth-client";
import { type LoginValues, loginSchema } from "@/lib/auth-schemas";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
	const { t } = useTranslation("auth");
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<LoginValues>({
		resolver: zodResolver(loginSchema),
		mode: "onBlur",
	});

	const onSubmit = async (values: LoginValues) => {
		// No `callbackURL` — Better Auth would auto-redirect there, overriding our
		// role-based landing.
		const { data, error } = await signIn.email({
			email: values.email,
			password: values.password,
		});

		if (error) {
			toast.error(error.message || t("toasts.error"));
			return;
		}

		toast.success(t("toasts.logged_in"));
		// Confirm the session is established + read the role, then HARD-navigate so
		// the destination loads fresh WITH the new session cookie. This sidesteps
		// the reactive useSession() store race that otherwise leaves users stuck on
		// /login until a second attempt. Hard nav (not SPA) is the reliable fix —
		// don't replace with navigate(); it reintroduces the race.
		const fresh = await authClient.getSession();
		const role = (
			(fresh?.data?.user ?? data?.user) as { role?: string } | undefined
		)?.role;
		window.location.assign(homeForRole(role));
	};

	return (
		<AuthLayout title={t("login.title")} subtitle={t("login.subtitle")}>
			<GoogleButton
				label={t("login.google")}
				onClick={() => signInWithGoogle()}
			/>
			<AuthDivider />
			<form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
				<FormField
					label={t("login.email")}
					type="email"
					autoComplete="email"
					error={errors.email?.message}
					{...register("email")}
				/>
				<div>
					<PasswordField
						label={t("login.password")}
						autoComplete="current-password"
						error={errors.password?.message}
						{...register("password")}
					/>
					<div className="mt-2 text-right">
						<Link
							to="/forgot-password"
							className="font-medium text-brand-primary text-sm hover:underline"
						>
							{t("login.forgot")}
						</Link>
					</div>
				</div>
				<Button
					type="submit"
					size="lg"
					disabled={isSubmitting}
					className="w-full"
				>
					{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
					{t("login.submit")}
				</Button>
			</form>
			<p className="mt-5 text-center text-slate-500 text-sm">
				{t("login.no_account")}{" "}
				<Link
					to="/register"
					className="font-semibold text-brand-primary hover:underline"
				>
					{t("login.create")}
				</Link>
			</p>
		</AuthLayout>
	);
}
