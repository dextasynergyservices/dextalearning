import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
	ArrowDown,
	ArrowUp,
	CheckCircle2,
	ChevronRight,
	CircleAlert,
	FileStack,
	Loader2,
	Plus,
	Rocket,
	Trash2,
} from "lucide-react";
import type { ComponentType } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CourseSettingsPanel } from "@/components/authoring/course-settings-panel";
import { StudioShell } from "@/components/authoring/studio-shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import {
	createLesson,
	createModule,
	deleteCourse,
	deleteModule,
	getCourse,
	type ModuleNode,
	publishCourse,
	reorderLessons,
} from "@/lib/content-api";

export const Route = createFileRoute("/instructor/courses/$courseId")({
	component: InstructorCourseEditorRoute,
});

function InstructorCourseEditorRoute() {
	const { courseId } = Route.useParams();
	return <CourseEditorPage courseId={courseId} area="instructor" />;
}

const REASONS: Record<string, string> = {
	no_lessons: "editor.reason_no_lessons",
	no_content_type: "editor.reason_no_content_type",
	missing_transcript: "editor.reason_missing_transcript",
	video_not_encoded: "editor.reason_video_not_encoded",
	audio_not_encoded: "editor.reason_audio_not_encoded",
	empty_text: "editor.reason_empty_text",
	missing_pdf: "editor.reason_missing_pdf",
};

interface PublishIssue {
	lessonId?: string;
	title?: string;
	reason: string;
}

export function CourseEditorPage({
	courseId,
	area = "instructor",
}: {
	courseId: string;
	area?: "instructor" | "admin";
}) {
	const { t } = useTranslation("authoring");
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [moduleTitle, setModuleTitle] = useState("");
	const [issues, setIssues] = useState<PublishIssue[] | null>(null);
	const [deleteOpen, setDeleteOpen] = useState(false);

	const { data: course, isPending } = useQuery({
		queryKey: ["course", courseId],
		queryFn: () => getCourse(courseId),
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["course", courseId] });

	const addModule = useMutation({
		mutationFn: () => createModule(courseId, moduleTitle.trim()),
		onSuccess: () => {
			setModuleTitle("");
			invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const publish = useMutation({
		mutationFn: () => publishCourse(courseId),
		onSuccess: () => {
			setIssues(null);
			invalidate();
			toast.success(t("editor.published"));
		},
		onError: (e) => {
			if (e instanceof ApiError && e.code === "COURSE_NOT_PUBLISHABLE") {
				const detail = e.details as { issues?: PublishIssue[] } | undefined;
				setIssues(detail?.issues ?? []);
			} else {
				toast.error(e.message);
			}
		},
	});

	const removeCourse = useMutation({
		mutationFn: () => deleteCourse(courseId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["my-courses"] });
			queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
			toast.success(t("courses.deleted"));
			navigate({
				to: area === "admin" ? "/admin/courses" : "/instructor/courses",
			});
		},
		onError: (e) => toast.error(e.message),
	});

	return (
		<StudioShell
			title={course?.title ?? "…"}
			area={area}
			action={
				<div className="flex flex-wrap items-center justify-end gap-2">
					<span
						className={
							course?.status === "published" ? "badge-open" : "badge-soon"
						}
					>
						{course?.status === "published"
							? t("courses.published")
							: t("courses.draft")}
					</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setDeleteOpen(true)}
						className="text-error hover:bg-error/5"
					>
						<Trash2 className="size-4" />
						{t("editor.delete")}
					</Button>
					<Button
						size="sm"
						onClick={() => publish.mutate()}
						disabled={publish.isPending}
					>
						{publish.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Rocket className="size-4" />
						)}
						{t("editor.publish")}
					</Button>
				</div>
			}
		>
			{isPending || !course ? (
				<div className="space-y-4">
					<Skeleton className="h-12 rounded-card" />
					<Skeleton className="h-40 rounded-card" />
				</div>
			) : (
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
									{t("editor.builder_eyebrow")}
								</p>
								<h2 className="mt-2 font-display text-2xl text-slate-900 sm:text-3xl">
									{course.title}
								</h2>
								<p className="mt-2 max-w-2xl text-slate-600 text-sm leading-relaxed">
									{t("editor.builder_body")}
								</p>
							</div>
							<div className="grid grid-cols-3 gap-2 lg:min-w-80">
								<EditorStat
									icon={FileStack}
									value={String(course.modules.length)}
									label={t("editor.stats.modules")}
								/>
								<EditorStat
									icon={CheckCircle2}
									value={String(
										course.modules.reduce(
											(total, mod) => total + mod.lessons.length,
											0,
										),
									)}
									label={t("editor.stats.lessons")}
								/>
								<EditorStat
									icon={CircleAlert}
									value={String(issues?.length ?? 0)}
									label={t("editor.stats.issues")}
								/>
							</div>
						</div>
					</motion.section>

					<CourseSettingsPanel course={course} />

					{issues ? (
						<div className="rounded-card border border-amber-300 bg-amber-50 p-4">
							<div className="flex items-center gap-2 font-medium text-amber-800">
								<CircleAlert className="size-5" />
								{t("editor.publish_blocked", "Fix these before publishing")}
							</div>
							<ul className="mt-2 space-y-1.5 text-sm">
								{issues.map((issue) => (
									<li
										key={`${issue.lessonId ?? "course"}-${issue.reason}`}
										className="flex items-start gap-2 text-amber-800"
									>
										<span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
										<span>
											{issue.title ? (
												<b className="font-semibold">{issue.title}: </b>
											) : null}
											{REASONS[issue.reason]
												? t(REASONS[issue.reason])
												: issue.reason}
										</span>
									</li>
								))}
							</ul>
						</div>
					) : null}

					{course.modules.map((mod) => (
						<motion.div
							key={mod.id}
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.28 }}
						>
							<ModuleCard module={mod} area={area} onChanged={invalidate} />
						</motion.div>
					))}

					{course.modules.length === 0 ? (
						<p className="rounded-card border border-slate-200 border-dashed bg-white py-12 text-center text-slate-400">
							{t("editor.no_modules")}
						</p>
					) : null}

					<form
						onSubmit={(e) => {
							e.preventDefault();
							if (moduleTitle.trim()) addModule.mutate();
						}}
						className="flex flex-col gap-3 rounded-card border border-slate-200 bg-white p-4 shadow-card sm:flex-row"
					>
						<input
							value={moduleTitle}
							onChange={(e) => setModuleTitle(e.target.value)}
							placeholder={t("editor.module_placeholder")}
							className="h-11 flex-1 rounded-input border border-slate-200 px-3.5 outline-none focus:border-brand-primary"
						/>
						<Button
							type="submit"
							variant="outline"
							disabled={addModule.isPending}
						>
							<Plus className="size-4" />
							{t("editor.add_module")}
						</Button>
					</form>
				</div>
			)}
			<ConfirmDialog
				open={deleteOpen}
				title={t("courses.delete_title")}
				description={t("courses.delete_description", {
					title: course?.title ?? "",
				})}
				confirmLabel={t("courses.delete_confirm")}
				cancelLabel={t("courses.delete_cancel")}
				isPending={removeCourse.isPending}
				tone="danger"
				onOpenChange={setDeleteOpen}
				onConfirm={() => removeCourse.mutate()}
			/>
		</StudioShell>
	);
}

function EditorStat({
	icon: Icon,
	value,
	label,
}: {
	icon: ComponentType<{ className?: string }>;
	value: string;
	label: string;
}) {
	return (
		<div className="rounded-btn border border-slate-200 bg-slate-50 p-3">
			<Icon className="size-4 text-brand-primary" />
			<p className="mt-2 font-stats font-bold text-xl text-slate-900">
				{value}
			</p>
			<p className="text-slate-500 text-xs leading-tight">{label}</p>
		</div>
	);
}

function ModuleCard({
	module,
	area,
	onChanged,
}: {
	module: ModuleNode;
	area: "instructor" | "admin";
	onChanged: () => void;
}) {
	const { t } = useTranslation("authoring");
	const [lessonTitle, setLessonTitle] = useState("");

	const addLesson = useMutation({
		mutationFn: () => createLesson(module.id, { title: lessonTitle.trim() }),
		onSuccess: () => {
			setLessonTitle("");
			onChanged();
		},
		onError: (e) => toast.error(e.message),
	});

	const removeModule = useMutation({
		mutationFn: () => deleteModule(module.id),
		onSuccess: onChanged,
		onError: (e) => toast.error(e.message),
	});

	const reorder = useMutation({
		mutationFn: (lessonIds: string[]) => reorderLessons(module.id, lessonIds),
		onSuccess: onChanged,
		onError: (e) => toast.error(e.message),
	});

	const move = (index: number, direction: -1 | 1) => {
		const ids = module.lessons.map((lesson) => lesson.id);
		const target = index + direction;
		if (target < 0 || target >= ids.length) return;
		const moved = ids[index];
		ids[index] = ids[target];
		ids[target] = moved;
		reorder.mutate(ids);
	};

	return (
		<section className="overflow-hidden rounded-card border border-slate-200 bg-white shadow-card">
			<div className="flex items-center justify-between gap-2 bg-slate-50 px-4 py-3">
				<h2 className="font-display text-slate-900">{module.title}</h2>
				<button
					type="button"
					aria-label={t("editor.delete")}
					onClick={() => removeModule.mutate()}
					className="flex size-8 items-center justify-center rounded-btn text-slate-400 transition-colors hover:bg-error/5 hover:text-error"
				>
					<Trash2 className="size-4" />
				</button>
			</div>

			<ul className="divide-y divide-slate-100">
				{module.lessons.map((lesson, index) => (
					<li key={lesson.id} className="flex items-center gap-1 px-2 py-1.5">
						<div className="flex flex-col">
							<button
								type="button"
								aria-label="Move up"
								disabled={index === 0 || reorder.isPending}
								onClick={() => move(index, -1)}
								className="flex size-5 items-center justify-center rounded text-slate-400 transition-colors hover:text-brand-primary disabled:opacity-30"
							>
								<ArrowUp className="size-3.5" />
							</button>
							<button
								type="button"
								aria-label="Move down"
								disabled={
									index === module.lessons.length - 1 || reorder.isPending
								}
								onClick={() => move(index, 1)}
								className="flex size-5 items-center justify-center rounded text-slate-400 transition-colors hover:text-brand-primary disabled:opacity-30"
							>
								<ArrowDown className="size-3.5" />
							</button>
						</div>
						<Link
							to={
								area === "admin"
									? "/admin/lessons/$lessonId"
									: "/instructor/lessons/$lessonId"
							}
							params={{ lessonId: lesson.id }}
							className="flex flex-1 items-center gap-3 rounded-btn px-2 py-2 transition-colors hover:bg-slate-50"
						>
							{lesson.transcriptText ? (
								<CheckCircle2 className="size-4 text-success" />
							) : (
								<span className="size-4 rounded-full border-2 border-slate-200" />
							)}
							<span className="flex-1 text-slate-700 text-sm">
								{lesson.title}
							</span>
							<span className="text-slate-400 text-xs uppercase">
								{lesson.contentType ?? "—"}
							</span>
							<ChevronRight className="size-4 text-slate-300" />
						</Link>
					</li>
				))}
			</ul>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (lessonTitle.trim()) addLesson.mutate();
				}}
				className="flex gap-2 border-slate-100 border-t p-3"
			>
				<input
					value={lessonTitle}
					onChange={(e) => setLessonTitle(e.target.value)}
					placeholder={t("editor.lesson_placeholder")}
					className="h-10 flex-1 rounded-input border border-slate-200 px-3 text-sm outline-none focus:border-brand-primary"
				/>
				<Button
					type="submit"
					variant="ghost"
					size="sm"
					disabled={addLesson.isPending}
				>
					<Plus className="size-4" />
					{t("editor.add_lesson")}
				</Button>
			</form>
		</section>
	);
}
