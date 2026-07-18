import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AuthDivider } from "@/components/auth/auth-divider";
import { AuthLayout } from "@/components/auth/auth-layout";
import { FormField } from "@/components/auth/form-field";
import { GoogleButton } from "@/components/auth/google-button";
import { PasswordField } from "@/components/auth/password-field";
import {
	TurnstileWidget,
	turnstileEnabled,
} from "@/components/auth/turnstile-widget";
import { Button } from "@/components/ui/button";
import {
	authClient,
	homeForRole,
	safeRedirect,
	signIn,
	signInWithGoogle,
} from "@/lib/auth-client";
import { type LoginValues, loginSchema } from "@/lib/auth-schemas";

export const Route = createFileRoute("/login")({
	component: LoginPage,
	validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
		redirect: typeof search.redirect === "string" ? search.redirect : undefined,
	}),
});

function LoginPage() {
	const { t } = useTranslation("auth");
	const { redirect } = Route.useSearch();
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
	const {
		register,
		handleSubmit,
		getValues,
		formState: { errors, isSubmitting },
	} = useForm<LoginValues>({
		resolver: zodResolver(loginSchema),
		mode: "onBlur",
	});

	const onSubmit = async (values: LoginValues) => {
		if (turnstileEnabled() && !turnstileToken) {
			toast.error(
				t("security.turnstile_wait", {
					defaultValue: "Please complete the verification below.",
				}),
			);
			return;
		}
		// No `callbackURL` — Better Auth would auto-redirect there, overriding our
		// role-based landing. The Turnstile token rides as a header the API's
		// pre-auth middleware verifies (§5.9).
		const { data, error } = await signIn.email(
			{ email: values.email, password: values.password },
			turnstileToken
				? { headers: { "x-turnstile-token": turnstileToken } }
				: undefined,
		);

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
		// Return the learner to where they came from (e.g. an Enroll click) if a
		// safe internal redirect was supplied; otherwise land on the role home.
		window.location.assign(safeRedirect(redirect) ?? homeForRole(role));
	};

	// Passwordless sign-in (additive, no conflict with password/Google — same
	// account by email). Uses the email field only; Better Auth's magic-link
	// plugin handles verification and redirects to `callbackURL`.
	const sendMagicLink = async () => {
		const email = getValues("email");
		if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
			toast.error(
				t("login.magic_need_email", {
					defaultValue: "Enter your email first.",
				}),
			);
			return;
		}
		// Land on the role-aware resolver (/continue) so staff reach their studio,
		// not the learner dashboard — honouring any specific redirect first.
		const safe = safeRedirect(redirect);
		await authClient.signIn.magicLink(
			{
				email,
				callbackURL: `${window.location.origin}/continue${
					safe ? `?redirect=${encodeURIComponent(safe)}` : ""
				}`,
				// A magic link can also create a brand-new account → onboard them,
				// same as registration / new-OAuth users.
				newUserCallbackURL: `${window.location.origin}/onboarding`,
			},
			{
				onSuccess: () => {
					toast.success(
						t("login.magic_sent", {
							defaultValue: "Sign-in link sent — check your email.",
						}),
					);
				},
				onError: (ctx) => {
					toast.error(ctx.error.message || t("toasts.error"));
				},
			},
		);
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
				<TurnstileWidget onToken={setTurnstileToken} />
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
			<Button
				type="button"
				variant="outline"
				size="lg"
				onClick={sendMagicLink}
				className="mt-3 w-full"
			>
				<Sparkles className="size-4" />
				{t("login.magic_cta", { defaultValue: "Email me a sign-in link" })}
			</Button>
			<p className="mt-5 text-center text-muted-foreground text-sm">
				{t("login.no_account")}{" "}
				<Link
					to="/register"
					search={{ redirect }}
					className="font-semibold text-brand-primary hover:underline"
				>
					{t("login.create")}
				</Link>
			</p>
		</AuthLayout>
	);
}
