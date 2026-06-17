import { Link } from "@tanstack/react-router";
import { Compass, House, Search, UserRound } from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

interface TabItem {
	to: string;
	labelKey: string;
	icon: ComponentType<{ className?: string }>;
	exact?: boolean;
}

function initialOf(name?: string | null): string {
	return name?.trim()?.charAt(0).toUpperCase() || "U";
}

/**
 * Mobile bottom tab bar — present on ALL public pages (blueprint §9.5, §10),
 * always visible (never scroll-hidden). No hamburger menu. Hidden from lg up,
 * where the desktop header takes over. The account tab reflects auth state:
 * a signed-in user sees their avatar (→ profile); a guest sees a sign-in icon.
 */
export function BottomTabBar() {
	const { t } = useTranslation("common");
	const { data: session } = useSession();

	const tabs: TabItem[] = [
		{ to: "/", labelKey: "home", icon: House, exact: true },
		{ to: "/teachers/courses", labelKey: "explore", icon: Compass },
		{ to: "/search", labelKey: "search", icon: Search },
		{
			to: session ? "/profile" : "/login",
			labelKey: "account",
			icon: UserRound,
		},
	];

	return (
		<nav
			aria-label="Primary"
			className="fixed inset-x-0 bottom-0 z-50 border-slate-200 border-t bg-white shadow-[0_-4px_20px_-8px_rgba(15,23,42,0.18)] lg:hidden"
			style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
		>
			<ul className="mx-auto flex max-w-md items-stretch justify-around">
				{tabs.map(({ to, labelKey, icon: Icon, exact }) => {
					const isAccount = labelKey === "account";
					return (
						<li key={labelKey} className="flex-1">
							<Link
								to={to}
								activeOptions={{ exact: Boolean(exact) }}
								className="group flex flex-col items-center gap-1 px-1 pt-2 pb-1.5 text-slate-400"
								activeProps={{ className: "text-brand-primary" }}
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
											{isAccount && session ? (
												<span
													className={cn(
														"flex size-6 items-center justify-center rounded-full font-semibold text-[11px]",
														isActive
															? "bg-brand-primary text-white"
															: "bg-slate-200 text-slate-600",
													)}
												>
													{initialOf(session.user.name)}
												</span>
											) : (
												<Icon className="size-5" />
											)}
										</span>
										<span
											className={cn(
												"font-stats text-[0.62rem] font-semibold tracking-wide uppercase",
												isActive ? "text-brand-primary" : "text-slate-500",
											)}
										>
											{t(`tabs.${labelKey}`)}
										</span>
									</>
								)}
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
