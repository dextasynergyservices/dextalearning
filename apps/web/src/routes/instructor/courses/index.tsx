import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
	BookOpen,
	CheckCircle2,
	FileStack,
	Loader2,
	Plus,
	Trash2,
} from "lucide-react";
import type { ComponentType } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { StudioShell } from "@/components/authoring/studio-shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
	type CourseSummary,
	createCourse,
	deleteCourse,
	listMyCourses,
} from "@/lib/content-api";

export const Route = createFileRoute("/instructor/courses/")({
	component: InstructorCoursesRoute,
});

function InstructorCoursesRoute() {
	return <CoursesPage area="instructor" />;
}

export function CoursesPage({
	area = "instructor",
}: {
	area?: "instructor" | "admin";
}) {
	const { t } = useTranslation("authoring");
	const queryClient = useQueryClient();
	const queryKey = area === "admin" ? ["admin-courses"] : ["my-courses"];
	const isAdminArea = area === "admin";
	const [title, setTitle] = useState("");
	const [creating, setCreating] = useState(false);
	const [courseToDelete, setCourseToDelete] = useState<CourseSummary | null>(
		null,
	);

	const { data: courses, isPending } = useQuery({
		queryKey,
		queryFn: listMyCourses,
	});
	const publishedCount =
		courses?.filter((course) => course.status === "published").length ?? 0;
	const moduleCount =
		courses?.reduce((total, course) => total + course._count.modules, 0) ?? 0;

	const create = useMutation({
		mutationFn: () => createCourse({ title: title.trim() }),
		onSuccess: () => {
			setTitle("");
			setCreating(false);
			queryClient.invalidateQueries({ queryKey });
		},
		onError: (error) => toast.error(error.message),
	});

	const removeCourse = useMutation({
		mutationFn: (courseId: string) => deleteCourse(courseId),
		onSuccess: () => {
			setCourseToDelete(null);
			queryClient.invalidateQueries({ queryKey });
			toast.success(t("courses.deleted"));
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<StudioShell
			title={t(isAdminArea ? "courses.admin_title" : "courses.title")}
			area={area}
			action={
				<Button size="sm" onClick={() => setCreating((v) => !v)}>
					<Plus className="size-4" />
					{t("courses.new")}
				</Button>
			}
		>
			<div className="space-y-5">
				<motion.section
					initial={{ opacity: 0, y: 14 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.34 }}
					className="rounded-card border border-brand-primary/15 bg-white p-4 shadow-card sm:p-6"
				>
					<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
						<div>
							<p className="font-stats font-semibold text-brand-primary text-xs uppercase">
								{t(isAdminArea ? "courses.admin_eyebrow" : "courses.eyebrow")}
							</p>
							<h2 className="mt-2 font-display text-2xl text-slate-900 sm:text-3xl">
								{t(isAdminArea ? "courses.admin_heading" : "courses.heading")}
							</h2>
							<p className="mt-2 max-w-2xl text-slate-600 text-sm leading-relaxed">
								{t(isAdminArea ? "courses.admin_subtitle" : "courses.subtitle")}
							</p>
						</div>
						<div className="grid grid-cols-3 gap-2 lg:min-w-80">
							<StudioStat
								icon={BookOpen}
								value={isPending ? null : String(courses?.length ?? 0)}
								label={t("courses.stats.total")}
							/>
							<StudioStat
								icon={CheckCircle2}
								value={isPending ? null : String(publishedCount)}
								label={t("courses.stats.published")}
							/>
							<StudioStat
								icon={FileStack}
								value={isPending ? null : String(moduleCount)}
								label={t("courses.stats.modules")}
							/>
						</div>
					</div>
				</motion.section>

				{creating ? (
					<form
						onSubmit={(e) => {
							e.preventDefault();
							if (title.trim().length >= 3) create.mutate();
						}}
						className="mt-5 flex flex-col gap-3 rounded-card border border-slate-200 bg-white p-4 shadow-card sm:flex-row sm:items-center"
					>
						<input
							// biome-ignore lint/a11y/noAutofocus: focus the field the user just opened.
							autoFocus
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder={t("courses.field_title")}
							className="h-11 flex-1 rounded-input border border-slate-200 px-3.5 text-slate-900 outline-none focus:border-brand-primary"
						/>
						<Button
							type="submit"
							disabled={title.trim().length < 3 || create.isPending}
						>
							{create.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Plus className="size-4" />
							)}
							{t("courses.create")}
						</Button>
					</form>
				) : null}

				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{isPending ? (
						["a", "b", "c"].map((k) => (
							<Skeleton key={k} className="h-40 rounded-card" />
						))
					) : courses && courses.length > 0 ? (
						courses.map((course) => (
							<motion.article
								key={course.id}
								whileHover={{ y: -4 }}
								whileTap={{ scale: 0.99 }}
								className="group flex flex-col rounded-card border border-slate-200 bg-white shadow-card transition-colors hover:border-brand-primary/30 hover:shadow-card-hover"
							>
								<Link
									to={
										isAdminArea
											? "/admin/courses/$courseId"
											: "/instructor/courses/$courseId"
									}
									params={{ courseId: course.id }}
									className="flex flex-1 flex-col"
								>
									<div className="flex flex-1 flex-col p-4 pb-3">
										<div className="flex items-start justify-between gap-2">
											<span className="flex size-11 shrink-0 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
												<BookOpen className="size-5" />
											</span>
											<h3 className="line-clamp-2 font-display text-slate-900">
												{course.title}
											</h3>
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
										</div>
										<p className="mt-auto flex items-center gap-1.5 pt-3 text-slate-400 text-xs">
											<FileStack className="size-3.5" />
											{t("courses.modules", { count: course._count.modules })}
										</p>
									</div>
								</Link>
								<div className="flex items-center justify-end border-slate-100 border-t px-3 py-2">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setCourseToDelete(course)}
										className="text-error hover:bg-error/5"
									>
										<Trash2 className="size-4" />
										{t("editor.delete")}
									</Button>
								</div>
							</motion.article>
						))
					) : (
						<div className="col-span-full rounded-card border border-slate-200 border-dashed bg-white py-16 text-center">
							<BookOpen className="mx-auto size-8 text-slate-300" />
							<p className="mt-3 text-slate-400">
								{t(isAdminArea ? "courses.admin_empty" : "courses.empty")}
							</p>
							<Button
								className="mt-4"
								size="sm"
								onClick={() => setCreating(true)}
							>
								<Plus className="size-4" />
								{t("courses.new")}
							</Button>
						</div>
					)}
				</div>
			</div>
			<ConfirmDialog
				open={Boolean(courseToDelete)}
				title={t("courses.delete_title")}
				description={t("courses.delete_description", {
					title: courseToDelete?.title ?? "",
				})}
				confirmLabel={t("courses.delete_confirm")}
				cancelLabel={t("courses.delete_cancel")}
				isPending={removeCourse.isPending}
				tone="danger"
				onOpenChange={(open) => {
					if (!open) setCourseToDelete(null);
				}}
				onConfirm={() => {
					if (courseToDelete) removeCourse.mutate(courseToDelete.id);
				}}
			/>
		</StudioShell>
	);
}

function StudioStat({
	icon: Icon,
	value,
	label,
}: {
	icon: ComponentType<{ className?: string }>;
	value: string | null;
	label: string;
}) {
	return (
		<div className="rounded-btn border border-slate-200 bg-slate-50 p-3">
			<Icon className="size-4 text-brand-primary" />
			{value === null ? (
				<Skeleton className="mt-3 h-6 w-10 rounded-btn" />
			) : (
				<p className="mt-2 font-stats font-bold text-xl text-slate-900">
					{value}
				</p>
			)}
			<p className="text-slate-500 text-xs leading-tight">{label}</p>
		</div>
	);
}
