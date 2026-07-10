import { Link } from "@tanstack/react-router";
import { UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RequireAuth } from "@/components/auth/require-auth";
import { Logo } from "@/components/brand/logo";
import { AccountMenu } from "@/components/layout/account-menu";

/**
 * Facilitator portal chrome (§4.7). Deliberately light: facilitation is a
 * per-cohort assignment open to any user, so this shell doesn't assume the
 * instructor/admin studio — just a sticky app bar (brand + account) over a
 * focused content column. Guarded by `RequireAuth`; the pages themselves show
 * an empty state when the user facilitates nothing.
 */
export function FacilitatorShell({
	children,
	title,
}: {
	children: ReactNode;
	title: string;
}) {
	const { t } = useTranslation("facilitator");

	return (
		<RequireAuth>
			<div className="min-h-screen bg-muted">
				<header
					className="sticky top-0 z-40 border-border border-b bg-card/95 backdrop-blur"
					style={{ paddingTop: "env(safe-area-inset-top)" }}
				>
					<div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
						<Link to="/" className="shrink-0" aria-label={t("portal")}>
							<Logo className="h-7 w-auto" />
						</Link>
						<span className="hidden items-center gap-1.5 rounded-pill bg-brand-primary-light px-3 py-1 font-medium text-brand-primary text-sm sm:inline-flex">
							<UsersRound className="size-4" />
							{t("portal", { defaultValue: "Facilitator portal" })}
						</span>
						<AccountMenu />
					</div>
				</header>

				<main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
					<h1 className="mb-5 font-display text-2xl text-foreground sm:text-3xl">
						{title}
					</h1>
					{children}
				</main>
			</div>
		</RequireAuth>
	);
}
