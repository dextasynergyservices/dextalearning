import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
	ArrowRight,
	BookOpen,
	CheckCircle2,
	FileStack,
	Plus,
	Waypoints,
} from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { StudioShell } from "@/components/authoring/studio-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth-client";
import { listMyCourses, listMyPaths } from "@/lib/content-api";

export const Route = createFileRoute("/instructor/")({
	component: InstructorOverviewPage,
});

function firstName(name?: string | null): string {
	return name?.trim().split(" ")[0] ?? "";
}

function InstructorOverviewPage() {
	const { t } = useTranslation("authoring");
	const { data: session } = useSession();
	const courses = useQuery({
		queryKey: ["my-courses"],
		queryFn: listMyCourses,
	});
	const paths = useQuery({ queryKey: ["my-paths"], queryFn: listMyPaths });

	const loading = courses.isPending || paths.isPending;
	const published =
		courses.data?.filter((c) => c.status === "published").length ?? 0;
	const drafts =
		courses.data?.filter((c) => c.status !== "published").length ?? 0;

	return (
		<StudioShell title={t("instructor.title")} area="instructor">
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
								{t("instructor.eyebrow")}
							</p>
							<h2 className="mt-2 font-display text-2xl text-slate-900 sm:text-3xl">
								{session?.user?.name
									? t("instructor.greeting", {
											name: firstName(session.user.name),
										})
									: t("instructor.title")}
							</h2>
							<p className="mt-2 max-w-2xl text-slate-600 text-sm leading-relaxed">
								{t("instructor.body")}
							</p>
						</div>
						<Link
							to="/instructor/courses"
							className="inline-flex h-11 items-center justify-center gap-2 rounded-btn bg-brand-primary px-5 font-semibold text-sm text-white transition-colors hover:bg-brand-primary-hover"
						>
							<Plus className="size-4" />
							{t("instructor.build_cta")}
						</Link>
					</div>
				</motion.section>

				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<Stat
						icon={BookOpen}
						value={loading ? null : String(courses.data?.length ?? 0)}
						label={t("instructor.stats.courses")}
					/>
					<Stat
						icon={Waypoints}
						value={loading ? null : String(paths.data?.length ?? 0)}
						label={t("instructor.stats.paths")}
					/>
					<Stat
						icon={CheckCircle2}
						value={loading ? null : String(published)}
						label={t("instructor.stats.published")}
					/>
					<Stat
						icon={FileStack}
						value={loading ? null : String(drafts)}
						label={t("instructor.stats.drafts")}
					/>
				</div>

				<div className="grid gap-4 lg:grid-cols-2">
					<PortfolioCard
						icon={BookOpen}
						title={t("courses.title")}
						action={t("instructor.manage_courses")}
						to="/instructor/courses"
						count={loading ? null : (courses.data?.length ?? 0)}
					/>
					<PortfolioCard
						icon={Waypoints}
						title={t("paths.title")}
						action={t("instructor.manage_paths")}
						to="/instructor/paths"
						count={loading ? null : (paths.data?.length ?? 0)}
					/>
				</div>

				<div className="rounded-card border border-slate-200 bg-white shadow-card">
					<div className="border-slate-100 border-b px-4 py-4 sm:px-5">
						<p className="font-display text-xl text-slate-900">
							{t("instructor.recent_title")}
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
									to="/instructor/courses/$courseId"
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
								{t("instructor.empty")}
							</p>
						)}
					</div>
				</div>
			</div>
		</StudioShell>
	);
}

function Stat({
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
	action,
	to,
	count,
}: {
	icon: ComponentType<{ className?: string }>;
	title: string;
	action: string;
	to: "/instructor/courses" | "/instructor/paths";
	count: number | null;
}) {
	return (
		<Link
			to={to}
			className="group flex items-center gap-4 rounded-card border border-slate-200 bg-white p-5 shadow-card transition-all hover:-translate-y-1 hover:border-brand-primary/30 hover:shadow-card-hover"
		>
			<span className="flex size-12 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
				<Icon className="size-6" />
			</span>
			<div className="min-w-0 flex-1">
				<p className="font-display text-lg text-slate-900">{title}</p>
				<span className="flex items-center gap-1 font-semibold text-brand-primary text-sm transition-all group-hover:gap-1.5">
					{action}
					<ArrowRight className="size-4" />
				</span>
			</div>
			{count === null ? (
				<Skeleton className="h-8 w-10 rounded-btn" />
			) : (
				<span className="font-stats font-bold text-3xl text-slate-900">
					{count}
				</span>
			)}
		</Link>
	);
}
