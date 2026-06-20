import {
	Link,
	useLocation,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
	BarChart3,
	BookOpen,
	CalendarDays,
	ChevronLeft,
	GraduationCap,
	LayoutDashboard,
	LogOut,
	MoreHorizontal,
	Newspaper,
	Settings,
	ShieldCheck,
	Sparkles,
	UsersRound,
	Waypoints,
} from "lucide-react";
import { type ComponentType, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { RequireAuth } from "@/components/auth/require-auth";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

interface NavItem {
	to?: string;
	labelKey: string;
	icon: ComponentType<{ className?: string }>;
	soon?: boolean;
	exact?: boolean;
}

type StudioArea = "instructor" | "admin";

const INSTRUCTOR_NAV: NavItem[] = [
	{
		to: "/instructor",
		labelKey: "studio.nav.overview",
		icon: LayoutDashboard,
		exact: true,
	},
	{
		to: "/instructor/courses",
		labelKey: "studio.nav.courses",
		icon: BookOpen,
	},
	{ to: "/instructor/paths", labelKey: "studio.nav.paths", icon: Waypoints },
	{ labelKey: "studio.nav.analytics", icon: BarChart3, soon: true },
	{ labelKey: "studio.nav.settings", icon: Settings, soon: true },
];

const ADMIN_NAV: NavItem[] = [
	{
		to: "/admin",
		labelKey: "studio.nav.overview",
		icon: LayoutDashboard,
		exact: true,
	},
	{
		to: "/admin/courses",
		labelKey: "studio.nav.content",
		icon: BookOpen,
	},
	{ to: "/admin/paths", labelKey: "studio.nav.paths", icon: Waypoints },
	{ to: "/admin/cohorts", labelKey: "studio.nav.cohorts", icon: CalendarDays },
	{ to: "/admin/blog", labelKey: "studio.nav.blog", icon: Newspaper },
	{ labelKey: "studio.nav.users", icon: UsersRound, soon: true },
	{ labelKey: "studio.nav.analytics", icon: BarChart3, soon: true },
	{ labelKey: "studio.nav.settings", icon: Settings, soon: true },
];

const MOBILE_INSTRUCTOR_TABS: NavItem[] = [
	{
		to: "/instructor",
		labelKey: "studio.nav.overview",
		icon: LayoutDashboard,
		exact: true,
	},
	{
		to: "/instructor/courses",
		labelKey: "studio.nav.courses",
		icon: BookOpen,
	},
	{ to: "/instructor/paths", labelKey: "studio.nav.paths", icon: Waypoints },
];

const MOBILE_ADMIN_TABS: NavItem[] = [
	{
		to: "/admin",
		labelKey: "studio.nav.overview",
		icon: LayoutDashboard,
		exact: true,
	},
	{
		to: "/admin/courses",
		labelKey: "studio.nav.content",
		icon: BookOpen,
	},
	{ to: "/admin/paths", labelKey: "studio.nav.paths", icon: Waypoints },
	{ to: "/admin/cohorts", labelKey: "studio.nav.cohorts", icon: CalendarDays },
];

function initials(name?: string | null) {
	return (
		name
			?.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase())
			.join("") || "U"
	);
}

/**
 * Creator/Admin Studio chrome. Desktop uses a sidebar for dense operational
 * tools; mobile keeps a native top bar + bottom tab bar with no hamburger.
 */
export function StudioShell({
	title,
	action,
	children,
	area = "instructor",
}: {
	title: string;
	action?: ReactNode;
	children: ReactNode;
	area?: StudioArea;
}) {
	return (
		<RequireAuth>
			<StudioGate title={title} action={action} area={area}>
				{children}
			</StudioGate>
		</RequireAuth>
	);
}

function StudioGate({
	title,
	action,
	children,
	area,
}: {
	title: string;
	action?: ReactNode;
	children: ReactNode;
	area: StudioArea;
}) {
	const { t } = useTranslation("authoring");
	const { data: session } = useSession();
	const navigate = useNavigate();
	const router = useRouter();
	const location = useLocation();
	const role = (session?.user as { role?: string } | undefined)?.role;
	const allowed =
		area === "admin"
			? role === "admin"
			: role === "instructor" || role === "admin";
	const sidebarNav = area === "admin" ? ADMIN_NAV : INSTRUCTOR_NAV;
	const mobileTabs =
		area === "admin" ? MOBILE_ADMIN_TABS : MOBILE_INSTRUCTOR_TABS;
	const rootPaths = new Set([
		"/admin",
		"/admin/courses",
		"/admin/paths",
		"/admin/cohorts",
		"/admin/blog",
		"/instructor",
		"/instructor/courses",
		"/instructor/paths",
	]);
	const showBack = !rootPaths.has(location.pathname);
	const [moreOpen, setMoreOpen] = useState(false);
	const primaryTos = new Set(mobileTabs.map((tab) => tab.to));
	const moreItems = sidebarNav.filter(
		(item) => !(item.to && primaryTos.has(item.to)),
	);
	const moreActive = moreItems.some(
		(item) => item.to && location.pathname.startsWith(item.to),
	);

	const handleSignOut = async () => {
		await signOut();
		navigate({ to: "/" });
	};

	if (!allowed) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
				<GraduationCap className="size-10 text-slate-300" />
				<p className="font-display text-slate-900 text-xl">
					{t(
						area === "admin"
							? "studio.admin_only_title"
							: "studio.instructors_only_title",
					)}
				</p>
				<p className="max-w-sm text-slate-500">
					{t(
						area === "admin"
							? "studio.admin_only_body"
							: "studio.instructors_only_body",
					)}
				</p>
				<Link to="/dashboard" className="mt-2 font-semibold text-brand-primary">
					{t("studio.back_to_learning")}
				</Link>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-slate-50">
			<aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-slate-200 border-r bg-white lg:flex">
				<div className="border-slate-100 border-b px-5 py-5">
					<div className="flex items-center gap-3">
						<span className="flex size-10 items-center justify-center rounded-btn bg-brand-primary text-white">
							{area === "admin" ? (
								<ShieldCheck className="size-5" />
							) : (
								<Sparkles className="size-5" />
							)}
						</span>
						<div className="leading-tight">
							<p className="font-display text-slate-900 text-lg">
								DextaLearning
							</p>
							<p className="font-stats font-semibold text-brand-primary text-[0.7rem] uppercase">
								{t(
									area === "admin"
										? "studio.admin_label"
										: "studio.creator_label",
								)}
							</p>
						</div>
					</div>
				</div>

				<nav className="flex-1 space-y-1 px-3 py-4">
					{sidebarNav.map(({ to, labelKey, icon: Icon, soon, exact }) => {
						const cls = cn(
							"flex items-center gap-3 rounded-btn px-3 py-2.5 font-medium text-sm transition-colors",
							soon
								? "text-slate-400"
								: "text-slate-600 hover:bg-brand-primary-light hover:text-brand-primary",
						);
						const inner = (
							<>
								<Icon className="size-[1.15rem]" />
								<span className="flex-1">{t(labelKey)}</span>
								{soon ? (
									<span className="rounded-pill bg-slate-100 px-2 py-0.5 font-stats text-[0.6rem] text-slate-500 uppercase">
										{t("studio.soon")}
									</span>
								) : null}
							</>
						);
						return to ? (
							<Link
								key={labelKey}
								to={to}
								activeOptions={{ exact: Boolean(exact) }}
								className={cls}
								activeProps={{
									className: "bg-brand-primary-light text-brand-primary",
								}}
							>
								{inner}
							</Link>
						) : (
							<span key={labelKey} className={cls} aria-disabled>
								{inner}
							</span>
						);
					})}
				</nav>

				<div className="border-slate-100 border-t p-3">
					<div className="rounded-card bg-slate-50 p-3">
						<div className="flex items-center gap-3">
							<span className="flex size-10 items-center justify-center rounded-full bg-brand-primary font-semibold text-sm text-white">
								{initials(session?.user.name)}
							</span>
							<div className="min-w-0 flex-1 leading-tight">
								<p className="truncate font-medium text-slate-900 text-sm">
									{session?.user.name}
								</p>
								<p className="text-[0.7rem] text-slate-500 capitalize">
									{role}
								</p>
							</div>
						</div>
					</div>
					<Link
						to="/dashboard"
						className="mt-2 flex items-center gap-3 rounded-btn px-3 py-2 text-slate-600 text-sm transition-colors hover:bg-slate-100"
					>
						<GraduationCap className="size-[1.15rem] text-slate-400" />
						{t("studio.nav.learner")}
					</Link>
					<button
						type="button"
						onClick={handleSignOut}
						className="flex w-full items-center gap-3 rounded-btn px-3 py-2 text-slate-600 text-sm transition-colors hover:bg-error/5 hover:text-error"
					>
						<LogOut className="size-[1.15rem]" />
						{t("studio.nav.sign_out")}
					</button>
				</div>
			</aside>

			<div className="lg:pl-72">
				<header
					className="sticky top-0 z-20 border-slate-200 border-b bg-white/90 backdrop-blur-md"
					style={{ paddingTop: "env(safe-area-inset-top)" }}
				>
					<div className="flex min-h-14 items-center gap-3 px-4 py-2 lg:min-h-16 lg:px-8">
						{showBack ? (
							<button
								type="button"
								onClick={() => router.history.back()}
								aria-label={t("studio.nav.back")}
								className="flex size-10 shrink-0 items-center justify-center rounded-btn bg-slate-100 text-slate-700 transition-colors hover:bg-brand-primary-light hover:text-brand-primary"
							>
								<ChevronLeft className="size-5" />
							</button>
						) : null}
						<div className="min-w-0 flex-1">
							<p className="hidden font-stats font-semibold text-brand-primary text-[0.68rem] uppercase lg:block">
								{t(
									area === "admin"
										? "studio.admin_label"
										: "studio.creator_label",
								)}
							</p>
							<h1 className="truncate font-display text-slate-900 text-lg lg:text-xl">
								{title}
							</h1>
						</div>
						{action ? <div className="shrink-0">{action}</div> : null}
					</div>
				</header>

				<motion.main
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.34 }}
					className="mx-auto max-w-6xl px-4 pt-5 pb-24 lg:px-8 lg:pt-6 lg:pb-10"
				>
					{children}
				</motion.main>
			</div>

			<nav
				aria-label="Primary"
				className="fixed inset-x-0 bottom-0 z-40 border-slate-200 border-t bg-white shadow-[0_-4px_20px_-8px_rgba(15,23,42,0.18)] lg:hidden"
				style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
			>
				<ul className="mx-auto flex max-w-md items-stretch justify-around">
					{mobileTabs.map(({ to, labelKey, icon: Icon, exact }) => (
						<li key={labelKey} className="flex-1">
							<Link
								to={to ?? "/dashboard"}
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
											{t(labelKey)}
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
								{t("studio.nav.more", { defaultValue: "More" })}
							</span>
						</button>
					</li>
				</ul>
			</nav>

			{/* Mobile "More" bottom sheet — native overflow for secondary sections. */}
			<AnimatePresence>
				{moreOpen ? (
					<div className="fixed inset-0 z-50 lg:hidden">
						<motion.button
							type="button"
							aria-label={t("studio.nav.close", { defaultValue: "Close" })}
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
								<p className="px-3 py-1 font-stats font-semibold text-slate-400 text-xs uppercase">
									{t("studio.nav.more", { defaultValue: "More" })}
								</p>
								{moreItems.map(({ to, labelKey, icon: Icon }) =>
									to ? (
										<Link
											key={labelKey}
											to={to}
											onClick={() => setMoreOpen(false)}
											className="flex items-center gap-3 rounded-btn px-3 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50"
											activeProps={{
												className: "bg-brand-primary-light text-brand-primary",
											}}
										>
											<Icon className="size-5 text-slate-400" />
											{t(labelKey)}
										</Link>
									) : (
										<span
											key={labelKey}
											className="flex items-center gap-3 rounded-btn px-3 py-3 text-slate-400"
										>
											<Icon className="size-5" />
											<span className="flex-1">{t(labelKey)}</span>
											<span className="rounded-pill bg-slate-100 px-2 py-0.5 font-stats text-[0.6rem] uppercase">
												{t("studio.soon")}
											</span>
										</span>
									),
								)}
								<Link
									to="/dashboard"
									onClick={() => setMoreOpen(false)}
									className="flex items-center gap-3 rounded-btn px-3 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50"
								>
									<GraduationCap className="size-5 text-slate-400" />
									{t("studio.nav.learner")}
								</Link>
								<button
									type="button"
									onClick={handleSignOut}
									className="flex w-full items-center gap-3 rounded-btn px-3 py-3 font-medium text-error transition-colors hover:bg-error/5"
								>
									<LogOut className="size-5" />
									{t("studio.nav.sign_out")}
								</button>
							</div>
						</motion.div>
					</div>
				) : null}
			</AnimatePresence>
		</div>
	);
}
