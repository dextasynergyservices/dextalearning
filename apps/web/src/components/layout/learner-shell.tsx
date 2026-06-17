import { Link } from "@tanstack/react-router";
import { Compass, House, Search, Trophy, UserRound } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RequireAuth } from "@/components/auth/require-auth";
import { Logo } from "@/components/brand/logo";
import { AccountMenu } from "@/components/layout/account-menu";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { cn } from "@/lib/utils";

interface LearnerTab {
	to: string;
	key: string;
	icon: ComponentType<{ className?: string }>;
	exact?: boolean;
}

const LEARNER_TABS: LearnerTab[] = [
	{ to: "/dashboard", key: "home", icon: House, exact: true },
	{ to: "/teachers/courses", key: "explore", icon: Compass },
	{ to: "/search", key: "search", icon: Search },
	{ to: "/leaderboard", key: "leaderboard", icon: Trophy },
	{ to: "/profile", key: "profile", icon: UserRound },
];

// Desktop top nav omits Profile — the AccountMenu covers it on the right.
const DESKTOP_TABS = LEARNER_TABS.filter((tab) => tab.key !== "profile");

/**
 * Authenticated learner chrome (guarded): a sticky app bar with desktop tab nav
 * + account menu, and a native mobile bottom tab bar with an active indicator
 * (blueprint §9.5 — bottom tabs on all pages). Content is inset for the fixed
 * bars and safe areas.
 */
export function LearnerShell({
	children,
	title,
}: {
	children: ReactNode;
	title: string;
}) {
	const { t } = useTranslation("dashboard");

	return (
		<RequireAuth>
			<div className="flex min-h-screen flex-col bg-slate-50">
				<header
					className="sticky top-0 z-40 border-slate-200 border-b bg-white/90 backdrop-blur-md"
					style={{ paddingTop: "env(safe-area-inset-top)" }}
				>
					<div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 lg:h-16 lg:px-6">
						<Logo className="text-xl text-slate-900" />
						<nav className="hidden items-center gap-1 lg:flex">
							{DESKTOP_TABS.map(({ to, key, exact }) => (
								<Link
									key={to}
									to={to}
									activeOptions={{ exact: Boolean(exact) }}
									className="rounded-btn px-3.5 py-2 font-medium text-slate-600 text-sm transition-colors hover:bg-slate-100"
									activeProps={{
										className: "bg-brand-primary-light text-brand-primary",
									}}
								>
									{t(`nav.${key}`)}
								</Link>
							))}
						</nav>
						<div className="flex items-center gap-1.5">
							<LanguageSwitcher compact />
							<AccountMenu />
						</div>
					</div>
				</header>

				<main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 lg:px-6 lg:pb-12">
					<h1 className="sr-only">{title}</h1>
					{children}
				</main>

				<nav
					aria-label="Primary"
					className="fixed inset-x-0 bottom-0 z-50 border-slate-200 border-t bg-white shadow-[0_-4px_20px_-8px_rgba(15,23,42,0.18)] lg:hidden"
					style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
				>
					<ul className="mx-auto flex max-w-md items-stretch justify-around">
						{LEARNER_TABS.map(({ to, key, icon: Icon, exact }) => (
							<li key={to} className="flex-1">
								<Link
									to={to}
									activeOptions={{ exact: Boolean(exact) }}
									className="group flex flex-col items-center gap-1 px-1 pt-2 pb-1.5"
								>
									{({ isActive }) => (
										<>
											<span
												className={cn(
													"flex h-8 w-12 items-center justify-center rounded-full transition-colors",
													isActive
														? "bg-brand-primary-light text-brand-primary"
														: "text-slate-500 group-hover:text-slate-700",
												)}
											>
												<Icon className="size-5" />
											</span>
											<span
												className={cn(
													"font-stats text-[0.62rem] font-semibold tracking-wide uppercase",
													isActive ? "text-brand-primary" : "text-slate-500",
												)}
											>
												{t(`nav.${key}`)}
											</span>
										</>
									)}
								</Link>
							</li>
						))}
					</ul>
				</nav>
			</div>
		</RequireAuth>
	);
}
