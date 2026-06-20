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
import { PathSettingsPanel } from "@/components/authoring/path-settings-panel";
import { StudioShell } from "@/components/authoring/studio-shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
	addPathCourse,
	deletePath,
	getPath,
	publishPath,
	removePathCourse,
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

	const { data: path, isPending } = useQuery({
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
						{t("editor.publish")}
					</Button>
				</div>
			}
		>
			{isPending || !path ? (
				<div className="space-y-4">
					<Skeleton className="h-40 rounded-card" />
					<Skeleton className="h-40 rounded-card" />
				</div>
			) : (
				<div className="space-y-6">
					<PathSettingsPanel path={path} />

					{/* Courses in the path */}
					<section className="rounded-card border border-slate-200 bg-white shadow-card">
						<header className="border-slate-100 border-b px-4 py-3 sm:px-6">
							<h2 className="font-display text-slate-900 text-lg">
								{t("paths.courses_title", {
									defaultValue: "Courses in this path",
								})}
							</h2>
							<p className="mt-0.5 text-slate-500 text-sm">
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
											className="flex size-5 items-center justify-center rounded text-slate-400 transition-colors hover:text-brand-primary disabled:opacity-30"
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
											className="flex size-5 items-center justify-center rounded text-slate-400 transition-colors hover:text-brand-primary disabled:opacity-30"
										>
											<ArrowDown className="size-3.5" />
										</button>
									</div>
									<span className="flex size-8 shrink-0 items-center justify-center rounded-btn bg-brand-primary-light font-stats font-semibold text-brand-primary text-xs">
										{index + 1}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate font-medium text-slate-800 text-sm">
											{pc.course.title}
										</span>
										<span className="text-slate-400 text-xs">
											{pc.course.status === "published"
												? t("courses.published")
												: t("courses.draft")}
										</span>
									</span>
									<button
										type="button"
										aria-label={t("editor.delete")}
										onClick={() => remove.mutate(pc.course.id)}
										className="flex size-8 items-center justify-center rounded-btn text-slate-400 transition-colors hover:bg-error/5 hover:text-error"
									>
										<Trash2 className="size-4" />
									</button>
								</li>
							))}
							{path.pathCourses.length === 0 ? (
								<li className="px-4 py-8 text-center text-slate-400 text-sm">
									{t("paths.no_courses", {
										defaultValue: "No courses yet — add one below.",
									})}
								</li>
							) : null}
						</ul>

						{/* Add a course */}
						<div className="flex flex-col gap-2 border-slate-100 border-t p-3 sm:flex-row">
							<select
								value={addId}
								onChange={(e) => setAddId(e.target.value)}
								className="h-11 flex-1 rounded-input border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:border-brand-primary"
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
					</section>

					{path.pathCourses.some((pc) => pc.course.status !== "published") ? (
						<p className="flex items-center gap-2 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
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
				confirmLabel={t("courses.delete_confirm", { defaultValue: "Delete" })}
				cancelLabel={t("courses.delete_cancel", { defaultValue: "Cancel" })}
				isPending={removePath.isPending}
				tone="danger"
				onOpenChange={setDeleteOpen}
				onConfirm={() => removePath.mutate()}
			/>
		</StudioShell>
	);
}
