import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
	BookOpen,
	GraduationCap,
	House,
	Info,
	Mail,
	MessagesSquare,
	MoreHorizontal,
	Newspaper,
	Search,
	UsersRound,
	Waypoints,
} from "lucide-react";
import type { ComponentType } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getAcademies } from "@/lib/content-api";
import { useAcademyParam } from "@/lib/use-current-academy";
import { cn } from "@/lib/utils";

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
	const academy = useAcademyParam();
	const [moreOpen, setMoreOpen] = useState(false);
	const [academiesOpen, setAcademiesOpen] = useState(false);
	const { data: academies } = useQuery({
		queryKey: ["academies"],
		queryFn: getAcademies,
		staleTime: 5 * 60 * 1000,
	});
	const moreActive = MORE_PATHS.some((p) => location.pathname.startsWith(p));

	// Icon + label; shared by the home tab and the academy-scoped tabs.
	const tabContent =
		(Icon: ComponentType<{ className?: string }>, labelKey: string) =>
		({ isActive }: { isActive: boolean }) => (
			<>
				<span
					className={cn(
						"flex h-8 w-12 items-center justify-center rounded-full transition-colors",
						isActive
							? "bg-brand-primary-light text-brand-primary"
							: "text-muted-foreground group-hover:text-foreground",
					)}
				>
					<Icon className="size-5" />
				</span>
				<span
					className={cn(
						"font-stats text-[0.62rem] font-semibold tracking-wide uppercase",
						isActive ? "text-brand-primary" : "text-muted-foreground",
					)}
				>
					{t(`tabs.${labelKey}`)}
				</span>
			</>
		);

	const tabClass = "group flex flex-col items-center gap-1 px-1 pt-2 pb-1.5";
	const academyTabs = [
		{ to: "/$academy/courses", labelKey: "courses", icon: BookOpen },
		{ to: "/$academy/paths", labelKey: "paths", icon: Waypoints },
		{ to: "/$academy/cohorts", labelKey: "cohorts", icon: UsersRound },
	] as const;

	return (
		<>
			<nav
				aria-label="Primary"
				className="fixed inset-x-0 bottom-0 z-50 border-border border-t bg-card shadow-[0_-4px_20px_-8px_rgba(15,23,42,0.18)] lg:hidden"
				style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
			>
				<ul className="mx-auto flex max-w-md items-stretch justify-around">
					<li className="flex-1">
						<Link to="/" activeOptions={{ exact: true }} className={tabClass}>
							{tabContent(House, "home")}
						</Link>
					</li>
					{academy ? (
						academyTabs.map(({ to, labelKey, icon }) => (
							<li key={labelKey} className="flex-1">
								<Link to={to} params={{ academy }} className={tabClass}>
									{tabContent(icon, labelKey)}
								</Link>
							</li>
						))
					) : (
						<>
							<li className="flex-1">
								<button
									type="button"
									onClick={() => setAcademiesOpen(true)}
									className={tabClass}
								>
									{tabContent(
										GraduationCap,
										"academies",
									)({
										isActive: academiesOpen,
									})}
								</button>
							</li>
							<li className="flex-1">
								<Link to="/search" className={tabClass}>
									{tabContent(Search, "search")}
								</Link>
							</li>
						</>
					)}
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
										: "text-muted-foreground",
								)}
							>
								<MoreHorizontal className="size-5" />
							</span>
							<span
								className={cn(
									"font-stats text-[0.62rem] font-semibold tracking-wide uppercase",
									moreActive ? "text-brand-primary" : "text-muted-foreground",
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
							drag="y"
							dragConstraints={{ top: 0, bottom: 0 }}
							dragElastic={{ top: 0, bottom: 0.5 }}
							onDragEnd={(_, info) => {
								if (info.offset.y > 90 || info.velocity.y > 600) {
									setMoreOpen(false);
								}
							}}
							className="absolute inset-x-0 bottom-0 touch-none rounded-t-card border-border border-t bg-card shadow-modal"
							style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
						>
							<div className="mx-auto max-w-md p-3">
								<div className="mx-auto mb-2 h-1.5 w-10 cursor-grab rounded-full bg-border active:cursor-grabbing" />
								<p className="px-3 py-1 font-stats font-semibold text-muted-foreground text-xs uppercase tracking-wide">
									{t("tabs.more")}
								</p>
								{MORE_ITEMS.map(({ to, hash, labelKey, icon: Icon }) => (
									<Link
										key={labelKey}
										to={to}
										hash={hash}
										onClick={() => setMoreOpen(false)}
										className="flex items-center gap-3 rounded-btn px-3 py-3.5 font-medium text-foreground transition-colors hover:bg-accent active:bg-accent"
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

			{/* Academies sheet (global pages) — pick an academy to enter. */}
			<AnimatePresence>
				{academiesOpen ? (
					<div className="fixed inset-0 z-[60] lg:hidden">
						<motion.button
							type="button"
							aria-label={t("tabs.academies", { defaultValue: "Academies" })}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={() => setAcademiesOpen(false)}
							className="absolute inset-0 bg-slate-900/40"
						/>
						<motion.div
							initial={{ y: "100%" }}
							animate={{ y: 0 }}
							exit={{ y: "100%" }}
							transition={{ type: "spring", stiffness: 380, damping: 38 }}
							className="absolute inset-x-0 bottom-0 rounded-t-card border-border border-t bg-card shadow-modal"
							style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
						>
							<div className="mx-auto max-w-md p-3">
								<div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border" />
								<p className="px-3 py-1 font-stats font-semibold text-muted-foreground text-xs uppercase tracking-wide">
									{t("tabs.academies", { defaultValue: "Academies" })}
								</p>
								{(academies ?? []).map((a) => (
									<Link
										key={a.slug}
										to="/$academy"
										params={{ academy: a.slug }}
										onClick={() => setAcademiesOpen(false)}
										className="flex items-center gap-3 rounded-btn px-3 py-3.5 font-medium text-foreground transition-colors hover:bg-accent active:bg-accent"
									>
										<span className="flex size-9 items-center justify-center rounded-full bg-brand-primary-light text-brand-primary">
											<GraduationCap className="size-5" />
										</span>
										{a.name}
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
