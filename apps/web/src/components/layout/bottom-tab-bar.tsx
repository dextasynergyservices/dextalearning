import { Link, useLocation } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
	BookOpen,
	House,
	Info,
	Mail,
	MessagesSquare,
	MoreHorizontal,
	Newspaper,
	UsersRound,
	Waypoints,
} from "lucide-react";
import type { ComponentType } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface TabItem {
	to: string;
	labelKey: string;
	icon: ComponentType<{ className?: string }>;
	exact?: boolean;
}

const TABS: TabItem[] = [
	{ to: "/", labelKey: "home", icon: House, exact: true },
	{ to: "/teachers/courses", labelKey: "courses", icon: BookOpen },
	{ to: "/teachers/paths", labelKey: "paths", icon: Waypoints },
	{ to: "/teachers/cohorts", labelKey: "cohorts", icon: UsersRound },
];

interface MoreItem {
	to: string;
	hash?: string;
	labelKey: string;
	icon: ComponentType<{ className?: string }>;
}

const MORE_ITEMS: MoreItem[] = [
	{ to: "/blog", labelKey: "nav.blog", icon: Newspaper },
	{ to: "/about", labelKey: "nav.about", icon: Info },
	{ to: "/community", labelKey: "nav.community", icon: MessagesSquare },
	{ to: "/about", hash: "contact", labelKey: "nav.contact", icon: Mail },
];

const MORE_PATHS = ["/blog", "/about", "/community"];

/**
 * Mobile bottom tab bar — present on all public pages (blueprint §9.5, §10).
 * No hamburger. Primary destinations + a native "More" sheet (Blog, About,
 * Community, Contact). Account/sign-in lives in the top app bar. Hidden on lg+.
 */
export function BottomTabBar() {
	const { t } = useTranslation("common");
	const location = useLocation();
	const [moreOpen, setMoreOpen] = useState(false);
	const moreActive = MORE_PATHS.some((p) => location.pathname.startsWith(p));

	return (
		<>
			<nav
				aria-label="Primary"
				className="fixed inset-x-0 bottom-0 z-50 border-slate-200 border-t bg-white shadow-[0_-4px_20px_-8px_rgba(15,23,42,0.18)] lg:hidden"
				style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
			>
				<ul className="mx-auto flex max-w-md items-stretch justify-around">
					{TABS.map(({ to, labelKey, icon: Icon, exact }) => (
						<li key={labelKey} className="flex-1">
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
											{t(`tabs.${labelKey}`)}
										</span>
									</>
								)}
							</Link>
						</li>
					))}
					<li className="flex-1">
						<button
							type="button"
							onClick={() => setMoreOpen(true)}
							className="flex w-full flex-col items-center gap-1 px-1 pt-2 pb-1.5"
						>
							<span
								className={cn(
									"flex h-8 w-12 items-center justify-center rounded-full transition-colors",
									moreActive
										? "bg-brand-primary-light text-brand-primary"
										: "text-slate-500",
								)}
							>
								<MoreHorizontal className="size-5" />
							</span>
							<span
								className={cn(
									"font-stats text-[0.62rem] font-semibold tracking-wide uppercase",
									moreActive ? "text-brand-primary" : "text-slate-500",
								)}
							>
								{t("tabs.more")}
							</span>
						</button>
					</li>
				</ul>
			</nav>

			<AnimatePresence>
				{moreOpen ? (
					<div className="fixed inset-0 z-[60] lg:hidden">
						<motion.button
							type="button"
							aria-label={t("tabs.more")}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={() => setMoreOpen(false)}
							className="absolute inset-0 bg-slate-900/40"
						/>
						<motion.div
							initial={{ y: "100%" }}
							animate={{ y: 0 }}
							exit={{ y: "100%" }}
							transition={{ type: "spring", stiffness: 380, damping: 38 }}
							className="absolute inset-x-0 bottom-0 rounded-t-card border-slate-200 border-t bg-white shadow-modal"
							style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
						>
							<div className="mx-auto max-w-md p-3">
								<div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200" />
								<p className="px-3 py-1 font-stats font-semibold text-slate-400 text-xs uppercase tracking-wide">
									{t("tabs.more")}
								</p>
								{MORE_ITEMS.map(({ to, hash, labelKey, icon: Icon }) => (
									<Link
										key={labelKey}
										to={to}
										hash={hash}
										onClick={() => setMoreOpen(false)}
										className="flex items-center gap-3 rounded-btn px-3 py-3.5 font-medium text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100"
									>
										<span className="flex size-9 items-center justify-center rounded-full bg-brand-primary-light text-brand-primary">
											<Icon className="size-5" />
										</span>
										{t(labelKey)}
									</Link>
								))}
							</div>
						</motion.div>
					</div>
				) : null}
			</AnimatePresence>
		</>
	);
}
