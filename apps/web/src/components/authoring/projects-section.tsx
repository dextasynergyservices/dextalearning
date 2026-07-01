import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, FolderKanban, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	createProject,
	listProjects,
	type ProjectScope,
	type ProjectSummary,
} from "@/lib/content-api";

/**
 * Projects attached to a parent (§4.5). Lists existing projects + an add form;
 * creating one opens its editor. A parent can carry several projects.
 */
export function ProjectsSection({
	scope,
	parent,
	area,
}: {
	scope: ProjectScope;
	parent: { courseId?: string; pathId?: string; cohortId?: string };
	area: "instructor" | "admin";
}) {
	const { t } = useTranslation("authoring");
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [title, setTitle] = useState("");
	const queryKey = ["projects", parent] as const;

	const { data, isPending } = useQuery({
		queryKey,
		queryFn: () => listProjects(parent),
	});
	const projects = data ?? [];

	const editRoute =
		area === "admin"
			? "/admin/projects/$projectId"
			: "/instructor/projects/$projectId";

	const create = useMutation({
		mutationFn: () => createProject({ scope, title: title.trim(), ...parent }),
		onSuccess: (project) => {
			setTitle("");
			queryClient.invalidateQueries({ queryKey });
			navigate({ to: editRoute, params: { projectId: project.id } });
		},
		onError: (e) => toast.error(e.message),
	});

	return (
		<section className="rounded-card border border-border bg-card p-4 shadow-card sm:p-6">
			<h2 className="font-display text-lg text-foreground">
				{t("project.section_title", { defaultValue: "Projects" })}
			</h2>
			<p className="mt-0.5 mb-3 text-muted-foreground text-sm">
				{t("project.section_subtitle", {
					defaultValue: "Deliverables learners submit and you grade.",
				})}
			</p>

			{isPending ? (
				<div className="h-12 animate-pulse rounded-btn bg-muted" />
			) : projects.length > 0 ? (
				<ul className="mb-3 space-y-2">
					{projects.map((project) => (
						<ProjectRow
							key={project.id}
							project={project}
							onOpen={() =>
								navigate({ to: editRoute, params: { projectId: project.id } })
							}
						/>
					))}
				</ul>
			) : null}

			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (title.trim()) create.mutate();
				}}
				className="flex flex-col gap-2 sm:flex-row"
			>
				<input
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder={t("project.add_placeholder", {
						defaultValue: "New project title…",
					})}
					className="h-11 flex-1 rounded-input border border-border px-3.5 text-sm outline-none focus:border-brand-primary"
				/>
				<Button type="submit" variant="outline" disabled={create.isPending}>
					{create.isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Plus className="size-4" />
					)}
					{t("project.add", { defaultValue: "Add project" })}
				</Button>
			</form>
		</section>
	);
}

function ProjectRow({
	project,
	onOpen,
}: {
	project: ProjectSummary;
	onOpen: () => void;
}) {
	const { t } = useTranslation("authoring");
	return (
		<li>
			<button
				type="button"
				onClick={onOpen}
				className="flex w-full items-center gap-3 rounded-btn border border-border bg-card px-3.5 py-2.5 text-left transition-colors hover:border-brand-primary/40 hover:bg-accent"
			>
				<FolderKanban className="size-4 shrink-0 text-brand-primary" />
				<span className="min-w-0 flex-1">
					<span className="block truncate font-medium text-foreground text-sm">
						{project.title}
					</span>
					<span className="text-muted-foreground text-xs">
						{t(`project.grading_${project.gradingType}`, {
							defaultValue: project.gradingType,
						})}
						{" · "}
						{t("project.sub_count", {
							defaultValue: "{{n}} submissions",
							n: project._count?.submissions ?? 0,
						})}
					</span>
				</span>
				<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
			</button>
		</li>
	);
}
