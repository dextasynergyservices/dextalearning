import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowDown,
	ArrowUp,
	BookOpen,
	Loader2,
	Plus,
	Rocket,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { InlineCreate } from "@/components/authoring/inline-create";
import { IntroManager } from "@/components/authoring/intro-manager";
import { PathSettingsPanel } from "@/components/authoring/path-settings-panel";
import { StudioShell } from "@/components/authoring/studio-shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
	addPathCourse,
	createPathIntro,
	deletePath,
	getPath,
	publishPath,
	removePathCourse,
	removePathIntro,
	reorderPathCourses,
} from "@/lib/content-api";

export const Route = createFileRoute("/instructor/paths/$pathId")({
	component: PathEditorRoute,
});

function PathEditorRoute() {
	const { pathId } = Route.useParams();
	return <PathEditorPage pathId={pathId} area="instructor" />;
}

export function PathEditorPage({
	pathId,
	area = "instructor",
}: {
	pathId: string;
	area?: "instructor" | "admin";
}) {
	const { t } = useTranslation("authoring");
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [addId, setAddId] = useState("");
	const [deleteOpen, setDeleteOpen] = useState(false);

	const {
		data: path,
		isPending,
		isError,
		error,
	} = useQuery({
		queryKey: ["path", pathId],
		queryFn: () => getPath(pathId),
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["path", pathId] });

	const add = useMutation({
		mutationFn: (courseId: string) => addPathCourse(pathId, courseId),
		onSuccess: () => {
			setAddId("");
			invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const remove = useMutation({
		mutationFn: (courseId: string) => removePathCourse(pathId, courseId),
		onSuccess: invalidate,
		onError: (e) => toast.error(e.message),
	});

	const reorder = useMutation({
		mutationFn: (courseIds: string[]) => reorderPathCourses(pathId, courseIds),
		onSuccess: invalidate,
		onError: (e) => toast.error(e.message),
	});

	const publish = useMutation({
		mutationFn: () => publishPath(pathId),
		onSuccess: () => {
			invalidate();
			toast.success(t("paths.published", { defaultValue: "Path published" }));
		},
		onError: (e) => toast.error(e.message),
	});

	const removePath = useMutation({
		mutationFn: () => deletePath(pathId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["my-paths"] });
			queryClient.invalidateQueries({ queryKey: ["admin-paths"] });
			toast.success(t("paths.deleted", { defaultValue: "Path deleted" }));
			navigate({ to: area === "admin" ? "/admin/paths" : "/instructor/paths" });
		},
		onError: (e) => toast.error(e.message),
	});

	const move = (index: number, dir: -1 | 1) => {
		if (!path) return;
		const ids = path.pathCourses.map((pc) => pc.course.id);
		const target = index + dir;
		if (target < 0 || target >= ids.length) return;
		[ids[index], ids[target]] = [ids[target], ids[index]];
		reorder.mutate(ids);
	};

	return (
		<StudioShell
			title={path?.title ?? "…"}
			area={area}
			action={
				<div className="flex flex-wrap items-center justify-end gap-2">
					<span
						className={
							path?.status === "published" ? "badge-open" : "badge-soon"
						}
					>
						{path?.status === "published"
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
						{t("paths.publish", { defaultValue: "Publish path" })}
					</Button>
				</div>
			}
		>
			{isPending ? (
				<div className="space-y-4">
					<Skeleton className="h-40 rounded-card" />
					<Skeleton className="h-40 rounded-card" />
				</div>
			) : isError || !path ? (
				<div className="rounded-card border border-error/30 bg-error/5 p-5 text-error">
					<p className="font-semibold">
						{t("paths.load_failed", {
							defaultValue: "Path could not be loaded",
						})}
					</p>
					<p className="mt-1 text-sm">
						{error instanceof Error
							? error.message
							: t("paths.load_failed_body", {
									defaultValue: "Refresh the page or go back and try again.",
								})}
					</p>
				</div>
			) : (
				<div className="space-y-6">
					<PathSettingsPanel path={path} />

					<IntroManager
						id={path.id}
						intro={path.introLesson}
						editorArea={area}
						queryKey={["path", pathId]}
						createFn={createPathIntro}
						removeFn={removePathIntro}
					/>

					{/* Courses in the path */}
					<section className="rounded-card border border-border bg-card shadow-card">
						<header className="border-border border-b px-4 py-3 sm:px-6">
							<h2 className="font-display text-foreground text-lg">
								{t("paths.courses_title", {
									defaultValue: "Courses in this path",
								})}
							</h2>
							<p className="mt-0.5 text-muted-foreground text-sm">
								{t("paths.courses_subtitle", {
									defaultValue:
										"Order matters — learners progress top to bottom.",
								})}
							</p>
						</header>

						<ul className="divide-y divide-slate-100">
							{path.pathCourses.map((pc, index) => (
								<li
									key={pc.course.id}
									className="flex items-center gap-2 px-3 py-2.5 sm:px-4"
								>
									<div className="flex flex-col">
										<button
											type="button"
											aria-label="Move up"
											disabled={index === 0 || reorder.isPending}
											onClick={() => move(index, -1)}
											className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-brand-primary disabled:opacity-30"
										>
											<ArrowUp className="size-3.5" />
										</button>
										<button
											type="button"
											aria-label="Move down"
											disabled={
												index === path.pathCourses.length - 1 ||
												reorder.isPending
											}
											onClick={() => move(index, 1)}
											className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-brand-primary disabled:opacity-30"
										>
											<ArrowDown className="size-3.5" />
										</button>
									</div>
									<span className="flex size-8 shrink-0 items-center justify-center rounded-btn bg-brand-primary-light font-stats font-semibold text-brand-primary text-xs">
										{index + 1}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate font-medium text-foreground text-sm">
											{pc.course.title}
										</span>
										<span className="text-muted-foreground text-xs">
											{pc.course.status === "published"
												? t("courses.published")
												: t("courses.draft")}
										</span>
									</span>
									<button
										type="button"
										aria-label={t("editor.delete")}
										onClick={() => remove.mutate(pc.course.id)}
										className="flex size-8 items-center justify-center rounded-btn text-muted-foreground transition-colors hover:bg-error/5 hover:text-error"
									>
										<Trash2 className="size-4" />
									</button>
								</li>
							))}
							{path.pathCourses.length === 0 ? (
								<li className="px-4 py-8 text-center text-muted-foreground text-sm">
									{t("paths.no_courses", {
										defaultValue: "No courses yet — add one below.",
									})}
								</li>
							) : null}
						</ul>

						{/* Add a course */}
						<div className="flex flex-col gap-2 border-border border-t p-3 sm:flex-row">
							<select
								value={addId}
								onChange={(e) => setAddId(e.target.value)}
								className="h-11 flex-1 rounded-input border border-border bg-card px-3 text-foreground outline-none focus:border-brand-primary"
							>
								<option value="">
									{path.availableCourses.length
										? t("paths.add_placeholder", {
												defaultValue: "Choose a course to add…",
											})
										: t("paths.no_available", {
												defaultValue: "No more courses to add",
											})}
								</option>
								{path.availableCourses.map((c) => (
									<option key={c.id} value={c.id}>
										{c.title}
										{c.status === "published" ? "" : " (draft)"}
									</option>
								))}
							</select>
							<Button
								variant="outline"
								disabled={!addId || add.isPending}
								onClick={() => addId && add.mutate(addId)}
							>
								{add.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<Plus className="size-4" />
								)}
								{t("paths.add_course", { defaultValue: "Add course" })}
							</Button>
						</div>

						{/* Don't see the course? Create a draft inline. */}
						<div className="border-border border-t px-3 pb-3">
							<p className="mb-2 text-muted-foreground text-xs">
								{t("paths.or_create_course", {
									defaultValue: "Don't see it? Create a new draft course:",
								})}
							</p>
							<InlineCreate
								kind="course"
								attaching={add.isPending}
								academy={path.academy ?? undefined}
								onCreated={(courseId) => add.mutate(courseId)}
							/>
						</div>
					</section>

					{path.pathCourses.some((pc) => pc.course.status !== "published") ? (
						<p className="flex items-center gap-2 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-amber-800 dark:text-amber-200 text-sm">
							<BookOpen className="size-4 shrink-0" />
							{t("paths.draft_courses_note", {
								defaultValue:
									"Some courses are still drafts — publish them so learners can start.",
							})}
						</p>
					) : null}
				</div>
			)}

			<ConfirmDialog
				open={deleteOpen}
				title={t("paths.delete_title", { defaultValue: "Delete path?" })}
				description={t("paths.delete_description", {
					defaultValue:
						"“{{title}}” will be removed. Its courses are not deleted.",
					title: path?.title ?? "",
				})}
				confirmLabel={t("editor.delete", { defaultValue: "Delete" })}
				cancelLabel={t("editor.cancel", { defaultValue: "Cancel" })}
				isPending={removePath.isPending}
				tone="danger"
				onOpenChange={setDeleteOpen}
				onConfirm={() => removePath.mutate()}
			/>
		</StudioShell>
	);
}
