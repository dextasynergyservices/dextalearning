import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
	Clock3,
	Layers3,
	Loader2,
	Plus,
	Trash2,
	Waypoints,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { StudioShell } from "@/components/authoring/studio-shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
	createPath,
	deletePath,
	formatMoney,
	listMyPaths,
	type PathSummary,
} from "@/lib/content-api";

export const Route = createFileRoute("/instructor/paths/")({
	component: () => <PathsPage area="instructor" />,
});

export function PathsPage({
	area = "instructor",
}: {
	area?: "instructor" | "admin";
}) {
	const { t } = useTranslation("authoring");
	const queryClient = useQueryClient();
	const queryKey = area === "admin" ? ["admin-paths"] : ["my-paths"];
	const [title, setTitle] = useState("");
	const [creating, setCreating] = useState(false);
	const [toDelete, setToDelete] = useState<PathSummary | null>(null);

	const { data: paths, isPending } = useQuery({
		queryKey,
		queryFn: listMyPaths,
	});

	const create = useMutation({
		mutationFn: () => createPath({ title: title.trim() }),
		onSuccess: () => {
			setTitle("");
			setCreating(false);
			queryClient.invalidateQueries({ queryKey });
		},
		onError: (e) => toast.error(e.message),
	});

	const remove = useMutation({
		mutationFn: (id: string) => deletePath(id),
		onSuccess: () => {
			setToDelete(null);
			queryClient.invalidateQueries({ queryKey });
			toast.success(t("paths.deleted", { defaultValue: "Path deleted" }));
		},
		onError: (e) => toast.error(e.message),
	});

	const published = paths?.filter((p) => p.status === "published").length ?? 0;

	return (
		<StudioShell
			title={t("paths.title", { defaultValue: "Learning Paths" })}
			area={area}
			action={
				<Button size="sm" onClick={() => setCreating((v) => !v)}>
					<Plus className="size-4" />
					{t("paths.new", { defaultValue: "New path" })}
				</Button>
			}
		>
			<div className="space-y-5">
				<motion.section
					initial={{ opacity: 0, y: 14 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.34 }}
					className="rounded-card border border-brand-primary/15 bg-card p-4 shadow-card sm:p-6"
				>
					<p className="font-stats font-semibold text-brand-primary text-xs uppercase">
						{t("paths.eyebrow", { defaultValue: "Curate journeys" })}
					</p>
					<h2 className="mt-2 font-display text-2xl text-foreground sm:text-3xl">
						{t("paths.heading", { defaultValue: "Learning Paths" })}
					</h2>
					<p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-relaxed">
						{t("paths.subtitle", {
							defaultValue:
								"Bundle your courses into an ordered journey with its own price and Earn-Back.",
						})}
					</p>
					<div className="mt-4 flex gap-6 text-sm">
						<span className="text-muted-foreground">
							<b className="font-stats font-bold text-foreground text-lg">
								{isPending ? "—" : (paths?.length ?? 0)}
							</b>{" "}
							{t("paths.stat_total", { defaultValue: "paths" })}
						</span>
						<span className="text-muted-foreground">
							<b className="font-stats font-bold text-foreground text-lg">
								{isPending ? "—" : published}
							</b>{" "}
							{t("courses.published", { defaultValue: "published" })}
						</span>
					</div>
				</motion.section>

				{creating ? (
					<form
						onSubmit={(e) => {
							e.preventDefault();
							if (title.trim().length >= 3) create.mutate();
						}}
						className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center"
					>
						<input
							// biome-ignore lint/a11y/noAutofocus: focus the field the user just opened.
							autoFocus
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder={t("paths.field_title", {
								defaultValue: "Path title",
							})}
							className="h-11 flex-1 rounded-input border border-border px-3.5 text-foreground outline-none focus:border-brand-primary"
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
							{t("paths.create", { defaultValue: "Create path" })}
						</Button>
					</form>
				) : null}

				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{isPending ? (
						["a", "b", "c"].map((k) => (
							<Skeleton key={k} className="h-44 rounded-card" />
						))
					) : paths && paths.length > 0 ? (
						paths.map((path) => (
							<motion.article
								key={path.id}
								whileHover={{ y: -4 }}
								className="group flex flex-col overflow-hidden rounded-card border border-border bg-card shadow-card transition-colors hover:border-brand-primary/30 hover:shadow-card-hover"
							>
								<Link
									to={
										area === "admin"
											? "/admin/paths/$pathId"
											: "/instructor/paths/$pathId"
									}
									params={{ pathId: path.id }}
									className="flex flex-1 flex-col"
								>
									<div className="relative aspect-[16/7] overflow-hidden bg-muted">
										{path.thumbnailUrl ? (
											<img
												src={path.thumbnailUrl}
												alt=""
												className="size-full object-cover"
											/>
										) : (
											<span className="flex size-full items-center justify-center text-brand-primary/40">
												<Waypoints className="size-9" />
											</span>
										)}
										<span
											className={`absolute top-2 left-2 ${path.status === "published" ? "badge-open" : "badge-soon"}`}
										>
											{path.status === "published"
												? t("courses.published")
												: t("courses.draft")}
										</span>
									</div>
									<div className="flex flex-1 flex-col p-4">
										<h3 className="line-clamp-2 font-display text-foreground">
											{path.title}
										</h3>
										<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
											<span className="flex items-center gap-1">
												<Layers3 className="size-3.5" />
												{t("paths.courses_count", {
													defaultValue: "{{count}} courses",
													count: path._count.pathCourses,
												})}
											</span>
											{path.estimatedHours ? (
												<span className="flex items-center gap-1">
													<Clock3 className="size-3.5" />
													{t("paths.hours", {
														defaultValue: "{{count}}h",
														count: path.estimatedHours,
													})}
												</span>
											) : null}
										</div>
										<div className="mt-auto flex items-center justify-between pt-3">
											<span className="font-stats font-bold text-foreground text-sm">
												{path.isFree
													? t("catalog.free", {
															ns: "academy",
															defaultValue: "Free",
														})
													: formatMoney(path.currency, path.price ?? 0)}
											</span>
											{path.isEarnBackEligible ? (
												<span className="badge-earnback">
													{path.earnBackPercentage &&
													path.earnBackPercentage < 100
														? `${path.earnBackPercentage}%`
														: t("settings.earnback", {
																defaultValue: "Earn-Back",
															})}
												</span>
											) : null}
										</div>
									</div>
								</Link>
								<div className="flex items-center justify-end border-border border-t px-3 py-2">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setToDelete(path)}
										className="text-error hover:bg-error/5"
									>
										<Trash2 className="size-4" />
										{t("editor.delete")}
									</Button>
								</div>
							</motion.article>
						))
					) : (
						<EmptyState
							className="col-span-full"
							icon={Waypoints}
							title={t("paths.empty", {
								defaultValue: "No paths yet — create your first journey.",
							})}
						/>
					)}
				</div>
			</div>

			<ConfirmDialog
				open={Boolean(toDelete)}
				title={t("paths.delete_title", { defaultValue: "Delete path?" })}
				description={t("paths.delete_description", {
					defaultValue:
						"“{{title}}” will be removed. Its courses are not deleted.",
					title: toDelete?.title ?? "",
				})}
				confirmLabel={t("editor.delete", { defaultValue: "Delete" })}
				cancelLabel={t("editor.cancel", { defaultValue: "Cancel" })}
				isPending={remove.isPending}
				tone="danger"
				onOpenChange={(open) => !open && setToDelete(null)}
				onConfirm={() => toDelete && remove.mutate(toDelete.id)}
			/>
		</StudioShell>
	);
}
