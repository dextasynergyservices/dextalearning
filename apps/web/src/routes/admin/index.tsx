import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
	ArrowRight,
	BookOpen,
	CalendarDays,
	CheckCircle2,
	ShieldCheck,
	Waypoints,
} from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { StudioShell } from "@/components/authoring/studio-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { listCohorts, listMyCourses, listMyPaths } from "@/lib/content-api";

export const Route = createFileRoute("/admin/")({
	component: AdminDashboardPage,
});

function AdminDashboardPage() {
	const { t } = useTranslation("authoring");
	const courses = useQuery({
		queryKey: ["admin-courses"],
		queryFn: listMyCourses,
	});
	const paths = useQuery({ queryKey: ["admin-paths"], queryFn: listMyPaths });
	const cohorts = useQuery({
		queryKey: ["admin-cohorts"],
		queryFn: listCohorts,
	});

	const loading = courses.isPending || paths.isPending || cohorts.isPending;
	const publishedCourses =
		courses.data?.filter((c) => c.status === "published").length ?? 0;
	const publishedPaths =
		paths.data?.filter((p) => p.status === "published").length ?? 0;
	const openCohorts =
		cohorts.data?.filter((c) => c.status === "open").length ?? 0;
	const drafts = courses.data?.filter((c) => c.status !== "published") ?? [];

	return (
		<StudioShell title={t("admin.title")} area="admin">
			<div className="space-y-6">
				<motion.section
					initial={{ opacity: 0, y: 14 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.34 }}
					className="rounded-card border border-brand-primary/15 bg-white p-4 shadow-card sm:p-6"
				>
					<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
						<div>
							<p className="font-stats font-semibold text-brand-primary text-xs uppercase">
								{t("admin.eyebrow")}
							</p>
							<h2 className="mt-2 font-display text-2xl text-slate-900 sm:text-3xl">
								{t("admin.heading")}
							</h2>
							<p className="mt-2 max-w-2xl text-slate-600 text-sm leading-relaxed">
								{t("admin.body")}
							</p>
						</div>
						<Link
							to="/admin/courses"
							className="inline-flex h-11 items-center justify-center gap-2 rounded-btn bg-brand-primary px-5 font-semibold text-sm text-white transition-colors hover:bg-brand-primary-hover"
						>
							<BookOpen className="size-4" />
							{t("admin.manage_content")}
						</Link>
					</div>
				</motion.section>

				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<AdminStat
						icon={BookOpen}
						value={loading ? null : String(courses.data?.length ?? 0)}
						label={t("admin.stats.courses")}
					/>
					<AdminStat
						icon={Waypoints}
						value={loading ? null : String(paths.data?.length ?? 0)}
						label={t("admin.stats.paths")}
					/>
					<AdminStat
						icon={CalendarDays}
						value={loading ? null : String(cohorts.data?.length ?? 0)}
						label={t("admin.stats.cohorts")}
					/>
					<AdminStat
						icon={CheckCircle2}
						value={loading ? null : String(publishedCourses)}
						label={t("admin.stats.published")}
					/>
				</div>

				{/* Portfolio: courses, paths, cohorts at a glance */}
				<section>
					<p className="font-display text-slate-900 text-xl">
						{t("admin.portfolio_title")}
					</p>
					<p className="mt-1 text-slate-500 text-sm">
						{t("admin.portfolio_body")}
					</p>
					<div className="mt-4 grid gap-4 lg:grid-cols-3">
						<PortfolioCard
							icon={BookOpen}
							title={t("courses.title")}
							to="/admin/courses"
							count={loading ? null : (courses.data?.length ?? 0)}
							sub={t("admin.stats.published")}
							subValue={publishedCourses}
						/>
						<PortfolioCard
							icon={Waypoints}
							title={t("paths.title")}
							to="/admin/paths"
							count={loading ? null : (paths.data?.length ?? 0)}
							sub={t("admin.stats.published")}
							subValue={publishedPaths}
						/>
						<PortfolioCard
							icon={CalendarDays}
							title={t("cohorts.title")}
							to="/admin/cohorts"
							count={loading ? null : (cohorts.data?.length ?? 0)}
							sub={t("cohorts.stat_open")}
							subValue={openCohorts}
						/>
					</div>
				</section>

				{/* Recent courses + guardrail */}
				<section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
					<div className="rounded-card border border-slate-200 bg-white shadow-card">
						<div className="border-slate-100 border-b px-4 py-4 sm:px-5">
							<p className="font-display text-xl text-slate-900">
								{t("admin.content_title")}
							</p>
							<p className="mt-1 text-slate-500 text-sm">
								{t("admin.content_body")}
							</p>
						</div>
						<div className="divide-y divide-slate-100">
							{courses.isPending ? (
								<div className="space-y-3 p-4">
									<Skeleton className="h-14 rounded-btn" />
									<Skeleton className="h-14 rounded-btn" />
								</div>
							) : courses.data && courses.data.length > 0 ? (
								courses.data.slice(0, 5).map((course) => (
									<Link
										key={course.id}
										to="/admin/courses/$courseId"
										params={{ courseId: course.id }}
										className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 sm:px-5"
									>
										<span className="flex size-10 shrink-0 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
											<BookOpen className="size-5" />
										</span>
										<span className="min-w-0 flex-1">
											<span className="line-clamp-1 font-medium text-slate-900 text-sm">
												{course.title}
											</span>
											<span className="mt-0.5 text-slate-500 text-xs">
												{t("courses.modules", { count: course._count.modules })}
											</span>
										</span>
										<span
											className={
												course.status === "published"
													? "badge-open"
													: "badge-soon"
											}
										>
											{course.status === "published"
												? t("courses.published")
												: t("courses.draft")}
										</span>
										<ArrowRight className="size-4 text-slate-300 group-hover:text-brand-primary" />
									</Link>
								))
							) : (
								<p className="p-6 text-center text-slate-500 text-sm">
									{t("admin.empty_content")}
								</p>
							)}
						</div>
					</div>

					<div className="rounded-card border border-brand-accent/25 bg-white p-4 shadow-card sm:p-5">
						<span className="flex size-10 items-center justify-center rounded-btn bg-brand-accent-light text-brand-accent">
							<ShieldCheck className="size-5" />
						</span>
						<p className="mt-4 font-display text-lg text-slate-900">
							{t("admin.guardrail_title")}
						</p>
						<p className="mt-2 text-slate-600 text-sm leading-relaxed">
							{t("admin.guardrail_body")}
						</p>
						<div className="mt-4 rounded-btn border border-slate-200 bg-slate-50 p-3">
							<p className="font-stats font-semibold text-slate-500 text-xs uppercase">
								{t("admin.needs_attention")}
							</p>
							<p className="mt-1 font-display text-2xl text-slate-900">
								{drafts.length}
							</p>
						</div>
					</div>
				</section>
			</div>
		</StudioShell>
	);
}

function AdminStat({
	icon: Icon,
	value,
	label,
}: {
	icon: ComponentType<{ className?: string }>;
	value: string | null;
	label: string;
}) {
	return (
		<motion.div
			whileHover={{ y: -2 }}
			className="rounded-card border border-slate-200 bg-white p-4 shadow-card"
		>
			<span className="flex size-9 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
				<Icon className="size-4" />
			</span>
			{value === null ? (
				<Skeleton className="mt-4 h-7 w-16 rounded-btn" />
			) : (
				<p className="mt-3 font-stats font-bold text-2xl text-slate-900">
					{value}
				</p>
			)}
			<p className="text-slate-500 text-xs">{label}</p>
		</motion.div>
	);
}

function PortfolioCard({
	icon: Icon,
	title,
	to,
	count,
	sub,
	subValue,
}: {
	icon: ComponentType<{ className?: string }>;
	title: string;
	to: "/admin/courses" | "/admin/paths" | "/admin/cohorts";
	count: number | null;
	sub: string;
	subValue: number;
}) {
	const { t } = useTranslation("authoring");
	return (
		<Link
			to={to}
			className="group flex flex-col rounded-card border border-slate-200 bg-white p-5 shadow-card transition-all hover:-translate-y-1 hover:border-brand-primary/30 hover:shadow-card-hover"
		>
			<div className="flex items-center justify-between">
				<span className="flex size-11 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
					<Icon className="size-5" />
				</span>
				{count === null ? (
					<Skeleton className="h-8 w-10 rounded-btn" />
				) : (
					<span className="font-stats font-bold text-3xl text-slate-900">
						{count}
					</span>
				)}
			</div>
			<p className="mt-4 font-display text-lg text-slate-900">{title}</p>
			<p className="mt-1 text-slate-500 text-sm">
				{subValue} {sub.toLowerCase()}
			</p>
			<span className="mt-4 flex items-center gap-1 font-semibold text-brand-primary text-sm transition-all group-hover:gap-1.5">
				{t("admin.manage")}
				<ArrowRight className="size-4" />
			</span>
		</Link>
	);
}
