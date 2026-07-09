import { useQuery } from "@tanstack/react-query";
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
	Library,
	LogOut,
	MoreHorizontal,
	Newspaper,
	PanelLeftClose,
	PanelLeftOpen,
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
import { getFeatureRequests } from "@/lib/content-api";
import { useAvatar } from "@/lib/use-avatar";
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
	{
		to: "/instructor/analytics",
		labelKey: "studio.nav.analytics",
		icon: BarChart3,
	},
	{
		to: "/learn/mine",
		labelKey: "studio.nav.my_learning",
		icon: Library,
	},
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
	{
		to: "/admin/integrity",
		labelKey: "studio.nav.integrity",
		icon: ShieldCheck,
	},
	{
		to: "/admin/analytics",
		labelKey: "studio.nav.analytics",
		icon: BarChart3,
	},
	{ labelKey: "studio.nav.users", icon: UsersRound, soon: true },
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
	{
		to: "/learn/mine",
		labelKey: "studio.nav.my_learning",
		icon: Library,
	},
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
	const avatar = useAvatar();
	const navigate = useNavigate();
	const router = useRouter();
	const location = useLocation();
	const role = (session?.user as { role?: string } | undefined)?.role;
	const allowed =
		area === "admin"
			? role === "admin"
			: role === "instructor" || role === "admin";
	// Admin-only: pending instructor feature requests, surfaced as a header badge.
	const { data: featureReqs } = useQuery({
		queryKey: ["feature-requests"],
		queryFn: getFeatureRequests,
		enabled: area === "admin" && role === "admin",
	});
	const pendingFeature = (featureReqs ?? []).filter(
		(r) => !r.isFeatured,
	).length;
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
	// Desktop sidebar collapse (icon-only), persisted across sessions.
	const [collapsed, setCollapsed] = useState(
		() =>
			typeof localStorage !== "undefined" &&
			localStorage.getItem("dexta-studio-collapsed") === "1",
	);
	const toggleCollapsed = () =>
		setCollapsed((value) => {
			const next = !value;
			try {
				localStorage.setItem("dexta-studio-collapsed", next ? "1" : "0");
			} catch {
				// storage disabled — collapse still works for the session.
			}
			return next;
		});
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
			<div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
				<GraduationCap className="size-10 text-muted-foreground" />
				<p className="font-display text-foreground text-xl">
					{t(
						area === "admin"
							? "studio.admin_only_title"
							: "studio.instructors_only_title",
					)}
				</p>
				<p className="max-w-sm text-muted-foreground">
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
		<div className="min-h-screen bg-background">
			<aside
				className={cn(
					"fixed inset-y-0 left-0 z-30 hidden flex-col border-border border-r bg-card transition-[width] duration-200 lg:flex",
					collapsed ? "w-20" : "w-72",
				)}
			>
				<div
					className={cn(
						"flex items-center border-border border-b py-4",
						collapsed ? "justify-center px-3" : "justify-between px-5",
					)}
				>
					{!collapsed ? (
						<div className="flex min-w-0 items-center gap-3">
							<span className="flex size-10 shrink-0 items-center justify-center rounded-btn bg-brand-primary text-white">
								{area === "admin" ? (
									<ShieldCheck className="size-5" />
								) : (
									<Sparkles className="size-5" />
								)}
							</span>
							<div className="min-w-0 leading-tight">
								<p className="truncate font-display text-foreground text-lg">
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
					) : null}
					<button
						type="button"
						onClick={toggleCollapsed}
						title={t("studio.nav.collapse", {
							defaultValue: "Collapse sidebar",
						})}
						aria-label={t("studio.nav.collapse", {
							defaultValue: "Collapse sidebar",
						})}
						className="flex size-9 shrink-0 items-center justify-center rounded-btn text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						{collapsed ? (
							<PanelLeftOpen className="size-5" />
						) : (
							<PanelLeftClose className="size-5" />
						)}
					</button>
				</div>

				<nav className="scrollbar-thin min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
					{sidebarNav.map(({ to, labelKey, icon: Icon, soon, exact }) => {
						const cls = cn(
							"flex items-center rounded-btn py-2.5 font-medium text-sm transition-colors",
							collapsed ? "justify-center px-0" : "gap-3 px-3",
							soon
								? "text-muted-foreground"
								: "text-muted-foreground hover:bg-brand-primary-light hover:text-brand-primary",
						);
						const showBadge = to === "/admin/courses" && pendingFeature > 0;
						const inner = collapsed ? (
							<span key={labelKey} className="relative">
								<Icon className="size-[1.15rem]" />
								{showBadge ? (
									<span className="-right-1.5 -top-1.5 absolute size-2.5 rounded-full bg-amber-500" />
								) : null}
							</span>
						) : (
							<>
								<Icon className="size-[1.15rem]" />
								<span className="flex-1">{t(labelKey)}</span>
								{showBadge ? (
									<span className="flex min-w-[1.2rem] items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 font-stats font-bold text-[0.65rem] text-white">
										{pendingFeature}
									</span>
								) : null}
								{soon ? (
									<span className="rounded-pill bg-muted px-2 py-0.5 font-stats text-[0.6rem] text-muted-foreground uppercase">
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
								title={collapsed ? t(labelKey) : undefined}
								activeProps={{
									className: "bg-brand-primary-light text-brand-primary",
								}}
							>
								{inner}
							</Link>
						) : (
							<span
								key={labelKey}
								className={cls}
								title={collapsed ? t(labelKey) : undefined}
								aria-disabled
							>
								{inner}
							</span>
						);
					})}
				</nav>

				<div className="border-border border-t p-3">
					<Link
						to={area === "admin" ? "/admin/profile" : "/instructor/profile"}
						className={cn(
							"flex items-center rounded-card bg-muted transition-colors hover:bg-accent",
							collapsed ? "justify-center p-2" : "gap-3 p-3",
						)}
						title={t("studio.nav.edit_profile", {
							defaultValue: "Edit profile",
						})}
					>
						{avatar ? (
							<img
								src={avatar}
								alt=""
								className="size-10 shrink-0 rounded-full object-cover"
							/>
						) : (
							<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-primary font-semibold text-sm text-white">
								{initials(session?.user.name)}
							</span>
						)}
						{!collapsed ? (
							<div className="min-w-0 flex-1 leading-tight">
								<p className="truncate font-medium text-foreground text-sm">
									{session?.user.name}
								</p>
								<p className="text-[0.7rem] text-muted-foreground capitalize">
									{role}
								</p>
							</div>
						) : null}
					</Link>
					<Link
						to="/dashboard"
						className={cn(
							"mt-2 flex items-center rounded-btn py-2 text-muted-foreground text-sm transition-colors hover:bg-accent",
							collapsed ? "justify-center px-0" : "gap-3 px-3",
						)}
						title={collapsed ? t("studio.nav.learner") : undefined}
					>
						<GraduationCap className="size-[1.15rem] shrink-0 text-muted-foreground" />
						{!collapsed ? t("studio.nav.learner") : null}
					</Link>
					<button
						type="button"
						onClick={handleSignOut}
						className={cn(
							"flex w-full items-center rounded-btn py-2 text-muted-foreground text-sm transition-colors hover:bg-error/5 hover:text-error",
							collapsed ? "justify-center px-0" : "gap-3 px-3",
						)}
						title={collapsed ? t("studio.nav.sign_out") : undefined}
					>
						<LogOut className="size-[1.15rem] shrink-0" />
						{!collapsed ? t("studio.nav.sign_out") : null}
					</button>
				</div>
			</aside>

			<div className={collapsed ? "lg:pl-20" : "lg:pl-72"}>
				<header
					className="sticky top-0 z-20 border-border border-b bg-card/90 backdrop-blur-md"
					style={{ paddingTop: "env(safe-area-inset-top)" }}
				>
					<div className="flex min-h-14 items-center gap-3 px-4 py-2 lg:min-h-16 lg:px-8">
						{showBack ? (
							<button
								type="button"
								onClick={() => router.history.back()}
								aria-label={t("studio.nav.back")}
								className="flex size-10 shrink-0 items-center justify-center rounded-btn bg-muted text-foreground transition-colors hover:bg-brand-primary-light hover:text-brand-primary"
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
							<h1 className="truncate font-display text-foreground text-lg lg:text-xl">
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
				className="fixed inset-x-0 bottom-0 z-40 border-border border-t bg-card shadow-[0_-4px_20px_-8px_rgba(15,23,42,0.18)] lg:hidden"
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
												"relative flex h-8 w-12 items-center justify-center rounded-full transition-colors",
												isActive
													? "bg-brand-primary-light text-brand-primary"
													: "text-muted-foreground group-hover:text-foreground",
											)}
										>
											<Icon className="size-5" />
											{to === "/admin/courses" && pendingFeature > 0 ? (
												<span className="-top-0.5 absolute right-1.5 flex min-w-[1.05rem] items-center justify-center rounded-full bg-amber-500 px-1 font-stats font-bold text-[0.6rem] text-white">
													{pendingFeature}
												</span>
											) : null}
										</span>
										<span
											className={cn(
												"font-stats text-[0.62rem] font-semibold tracking-wide uppercase",
												isActive
													? "text-brand-primary"
													: "text-muted-foreground",
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
								<p className="px-3 py-1 font-stats font-semibold text-muted-foreground text-xs uppercase">
									{t("studio.nav.more", { defaultValue: "More" })}
								</p>
								{moreItems.map(({ to, labelKey, icon: Icon }) =>
									to ? (
										<Link
											key={labelKey}
											to={to}
											onClick={() => setMoreOpen(false)}
											className="flex items-center gap-3 rounded-btn px-3 py-3 font-medium text-foreground transition-colors hover:bg-accent"
											activeProps={{
												className: "bg-brand-primary-light text-brand-primary",
											}}
										>
											<Icon className="size-5 text-muted-foreground" />
											{t(labelKey)}
										</Link>
									) : (
										<span
											key={labelKey}
											className="flex items-center gap-3 rounded-btn px-3 py-3 text-muted-foreground"
										>
											<Icon className="size-5" />
											<span className="flex-1">{t(labelKey)}</span>
											<span className="rounded-pill bg-muted px-2 py-0.5 font-stats text-[0.6rem] uppercase">
												{t("studio.soon")}
											</span>
										</span>
									),
								)}
								<Link
									to={
										area === "admin" ? "/admin/profile" : "/instructor/profile"
									}
									onClick={() => setMoreOpen(false)}
									className="flex items-center gap-3 rounded-btn px-3 py-3 font-medium text-foreground transition-colors hover:bg-accent"
								>
									{avatar ? (
										<img
											src={avatar}
											alt=""
											className="size-9 shrink-0 rounded-full object-cover"
										/>
									) : (
										<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-primary font-semibold text-sm text-white">
											{initials(session?.user.name)}
										</span>
									)}
									{t("studio.nav.edit_profile", {
										defaultValue: "Edit profile",
									})}
								</Link>
								<Link
									to="/dashboard"
									onClick={() => setMoreOpen(false)}
									className="flex items-center gap-3 rounded-btn px-3 py-3 font-medium text-foreground transition-colors hover:bg-accent"
								>
									<GraduationCap className="size-5 text-muted-foreground" />
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
