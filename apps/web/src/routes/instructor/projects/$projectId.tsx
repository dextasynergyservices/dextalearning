import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Inbox, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { StudioShell } from "@/components/authoring/studio-shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
	deleteProject,
	getProject,
	type ProjectDetail,
	type ProjectGradingType,
	type ProjectSubmissionType,
	type RubricCriterion,
	updateProject,
} from "@/lib/content-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/instructor/projects/$projectId")({
	component: InstructorProjectRoute,
});

function InstructorProjectRoute() {
	const { projectId } = Route.useParams();
	return <ProjectEditorPage projectId={projectId} area="instructor" />;
}

const SUBMISSION_TYPES: ProjectSubmissionType[] = [
	"file_upload",
	"text_submission",
	"url_submission",
	"peer_review",
];
const GRADING_TYPES: ProjectGradingType[] = [
	"manual",
	"ai_assisted",
	"peer_review",
];

function toLocalInput(iso: string | null): string {
	if (!iso) return "";
	const d = new Date(iso);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ProjectEditorPage({
	projectId,
	area = "instructor",
}: {
	projectId: string;
	area?: "instructor" | "admin";
}) {
	const { t } = useTranslation("authoring");
	const navigate = useNavigate();
	const [deleteOpen, setDeleteOpen] = useState(false);

	const { data: project, isPending } = useQuery({
		queryKey: ["project", projectId],
		queryFn: () => getProject(projectId),
	});

	const remove = useMutation({
		mutationFn: () => deleteProject(projectId),
		onSuccess: () => {
			toast.success(t("project.deleted", { defaultValue: "Project deleted" }));
			navigate({
				to: area === "admin" ? "/admin/courses" : "/instructor/courses",
			});
		},
		onError: (e) => toast.error(e.message),
	});

	return (
		<StudioShell
			title={project?.title ?? "…"}
			area={area}
			action={
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() =>
							navigate({
								to:
									area === "admin"
										? "/admin/project-submissions/$projectId"
										: "/instructor/project-submissions/$projectId",
								params: { projectId },
							})
						}
					>
						<Inbox className="size-4" />
						{t("grade.queue_title", { defaultValue: "Submissions" })}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setDeleteOpen(true)}
						className="text-error hover:bg-error/5"
					>
						<Trash2 className="size-4" />
						{t("project.delete", { defaultValue: "Delete" })}
					</Button>
				</div>
			}
		>
			{isPending || !project ? (
				<div className="space-y-4">
					<Skeleton className="h-24 rounded-card" />
					<Skeleton className="h-64 rounded-card" />
				</div>
			) : (
				<ProjectForm project={project} />
			)}
			<ConfirmDialog
				open={deleteOpen}
				title={t("project.delete_title", { defaultValue: "Delete project?" })}
				description={t("project.delete_desc", {
					defaultValue: "This removes the project and all its submissions.",
				})}
				confirmLabel={t("project.delete", { defaultValue: "Delete" })}
				cancelLabel={t("project.cancel", { defaultValue: "Cancel" })}
				isPending={remove.isPending}
				tone="danger"
				onOpenChange={setDeleteOpen}
				onConfirm={() => remove.mutate()}
			/>
		</StudioShell>
	);
}

function ProjectForm({ project }: { project: ProjectDetail }) {
	const { t } = useTranslation("authoring");
	const queryClient = useQueryClient();

	const [title, setTitle] = useState(project.title);
	const [description, setDescription] = useState(project.description ?? "");
	const [types, setTypes] = useState<ProjectSubmissionType[]>(
		(project.submissionTypes as ProjectSubmissionType[]) ?? ["file_upload"],
	);
	const [grading, setGrading] = useState<ProjectGradingType>(
		project.gradingType,
	);
	const [passMark, setPassMark] = useState(String(project.passMark ?? 70));
	const [due, setDue] = useState(toLocalInput(project.dueAt));
	const [maxFileSize, setMaxFileSize] = useState(
		String(project.maxFileSizeMb ?? 50),
	);
	const [fileTypes, setFileTypes] = useState(
		(project.allowedFileTypes ?? []).join(", "),
	);
	const [peerCount, setPeerCount] = useState(
		String(project.peerReviewCount ?? 2),
	);
	const [rubric, setRubric] = useState<RubricCriterion[]>(
		project.rubricJson ?? [],
	);

	const toggleType = (typ: ProjectSubmissionType) =>
		setTypes((prev) =>
			prev.includes(typ) ? prev.filter((x) => x !== typ) : [...prev, typ],
		);

	const showFile = types.includes("file_upload");
	const showPeer = grading === "peer_review" || types.includes("peer_review");
	const totalPoints = rubric.reduce(
		(s, r) => s + (Number(r.maxPoints) || 0),
		0,
	);

	const save = useMutation({
		mutationFn: () =>
			updateProject(project.id, {
				title: title.trim() || undefined,
				description: description.trim() || undefined,
				submissionTypes: types.length ? types : ["file_upload"],
				gradingType: grading,
				passMark: Number(passMark) || 70,
				dueAt: due ? new Date(due).toISOString() : null,
				maxFileSizeMb: Number(maxFileSize) || 50,
				allowedFileTypes: fileTypes
					.split(",")
					.map((s) => s.trim().replace(/^\./, "").toLowerCase())
					.filter(Boolean),
				peerReviewCount: Number(peerCount) || 0,
				rubric: rubric
					.filter((r) => r.label.trim())
					.map((r) => ({
						id: r.id,
						label: r.label.trim(),
						maxPoints: Number(r.maxPoints) || 1,
						description: r.description ?? null,
					})),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["project", project.id] });
			toast.success(t("project.saved", { defaultValue: "Project saved" }));
		},
		onError: (e) => toast.error(e.message),
	});

	return (
		<div className="space-y-6">
			<section className="rounded-card border border-border bg-card p-4 shadow-card sm:p-6">
				<p className="font-stats font-semibold text-brand-primary text-xs uppercase">
					{t(`project.scope_${project.scope}`, { defaultValue: project.scope })}
				</p>
				<div className="mt-3 space-y-4">
					<Field label={t("project.title", { defaultValue: "Title" })}>
						<input
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							maxLength={200}
							className="h-11 w-full rounded-input border border-border px-3.5 text-foreground outline-none focus:border-brand-primary"
						/>
					</Field>
					<Field label={t("project.description", { defaultValue: "Brief" })}>
						<textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={4}
							maxLength={5000}
							placeholder={t("project.description_ph", {
								defaultValue: "What should learners build and hand in?",
							})}
							className="w-full resize-none rounded-input border border-border px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-brand-primary"
						/>
					</Field>
				</div>
			</section>

			{/* Submission + grading */}
			<section className="rounded-card border border-border bg-card p-4 shadow-card sm:p-6">
				<h2 className="font-display text-lg text-foreground">
					{t("project.delivery", { defaultValue: "Submission & grading" })}
				</h2>
				<div className="mt-4 space-y-5">
					<div>
						<p className="mb-2 font-medium text-foreground text-sm">
							{t("project.types", { defaultValue: "Accepted submissions" })}
						</p>
						<div className="grid grid-cols-2 gap-2">
							{SUBMISSION_TYPES.map((typ) => (
								<button
									key={typ}
									type="button"
									onClick={() => toggleType(typ)}
									className={cn(
										"rounded-btn border px-3 py-2.5 text-left text-sm transition-colors",
										types.includes(typ)
											? "border-brand-primary bg-brand-primary/10 font-medium text-brand-primary"
											: "border-border text-muted-foreground hover:border-border",
									)}
								>
									{t(`project.type_${typ}`, { defaultValue: typ })}
								</button>
							))}
						</div>
					</div>

					<div className="grid gap-4 sm:grid-cols-3">
						<Field label={t("project.grading", { defaultValue: "Grading" })}>
							<Select
								value={grading}
								onChange={(v) => setGrading(v as ProjectGradingType)}
							>
								{GRADING_TYPES.map((g) => (
									<option key={g} value={g}>
										{t(`project.grading_${g}`, { defaultValue: g })}
									</option>
								))}
							</Select>
						</Field>
						<Field
							label={t("project.pass_mark", { defaultValue: "Pass mark %" })}
						>
							<input
								type="number"
								min={0}
								max={100}
								value={passMark}
								onChange={(e) => setPassMark(e.target.value)}
								className="h-11 w-full rounded-input border border-border px-3.5 outline-none focus:border-brand-primary"
							/>
						</Field>
						<Field label={t("project.due", { defaultValue: "Due date" })}>
							<input
								type="datetime-local"
								value={due}
								onChange={(e) => setDue(e.target.value)}
								className="h-11 w-full rounded-input border border-border px-3 outline-none focus:border-brand-primary"
							/>
						</Field>
					</div>

					{showFile ? (
						<div className="grid gap-4 rounded-card border border-border p-4 sm:grid-cols-2">
							<Field
								label={t("project.max_size", {
									defaultValue: "Max file size (MB)",
								})}
							>
								<input
									type="number"
									min={1}
									max={500}
									value={maxFileSize}
									onChange={(e) => setMaxFileSize(e.target.value)}
									className="h-11 w-full rounded-input border border-border px-3.5 outline-none focus:border-brand-primary"
								/>
							</Field>
							<Field
								label={t("project.file_types", {
									defaultValue: "Allowed types (comma-separated)",
								})}
							>
								<input
									value={fileTypes}
									onChange={(e) => setFileTypes(e.target.value)}
									placeholder="pdf, zip, png"
									className="h-11 w-full rounded-input border border-border px-3.5 outline-none focus:border-brand-primary"
								/>
							</Field>
						</div>
					) : null}

					{showPeer ? (
						<Field
							label={t("project.peer_count", {
								defaultValue: "Peer reviews required per submission",
							})}
						>
							<input
								type="number"
								min={0}
								max={10}
								value={peerCount}
								onChange={(e) => setPeerCount(e.target.value)}
								className="h-11 w-40 rounded-input border border-border px-3.5 outline-none focus:border-brand-primary"
							/>
						</Field>
					) : null}
				</div>
			</section>

			{/* Rubric */}
			<section className="rounded-card border border-border bg-card p-4 shadow-card sm:p-6">
				<div className="flex items-center justify-between">
					<h2 className="font-display text-lg text-foreground">
						{t("project.rubric", { defaultValue: "Rubric" })}{" "}
						<span className="font-stats text-muted-foreground text-sm">
							{t("project.total_pts", {
								defaultValue: "{{n}} pts",
								n: totalPoints,
							})}
						</span>
					</h2>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => setRubric([...rubric, { label: "", maxPoints: 10 }])}
					>
						<Plus className="size-4" />
						{t("project.add_criterion", { defaultValue: "Add criterion" })}
					</Button>
				</div>
				{rubric.length === 0 ? (
					<p className="mt-3 text-muted-foreground text-sm">
						{t("project.no_rubric", {
							defaultValue:
								"No rubric yet — add criteria to grade against (optional).",
						})}
					</p>
				) : (
					<ul className="mt-3 space-y-2">
						{rubric.map((crit, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: positional editable rows.
							<li key={i} className="flex items-center gap-2">
								<input
									value={crit.label}
									onChange={(e) => {
										const next = [...rubric];
										next[i] = { ...crit, label: e.target.value };
										setRubric(next);
									}}
									placeholder={t("project.criterion_ph", {
										defaultValue: "Criterion (e.g. Code quality)",
									})}
									className="h-10 flex-1 rounded-input border border-border px-3 text-sm outline-none focus:border-brand-primary"
								/>
								<input
									type="number"
									min={1}
									max={1000}
									value={crit.maxPoints}
									onChange={(e) => {
										const next = [...rubric];
										next[i] = { ...crit, maxPoints: Number(e.target.value) };
										setRubric(next);
									}}
									className="h-10 w-20 rounded-input border border-border px-2 text-sm outline-none focus:border-brand-primary"
								/>
								<button
									type="button"
									aria-label={t("project.remove", { defaultValue: "Remove" })}
									onClick={() =>
										setRubric(rubric.filter((_, idx) => idx !== i))
									}
									className="flex size-9 items-center justify-center rounded-btn text-muted-foreground hover:bg-error/5 hover:text-error"
								>
									<X className="size-4" />
								</button>
							</li>
						))}
					</ul>
				)}
			</section>

			<div className="flex justify-end">
				<Button onClick={() => save.mutate()} disabled={save.isPending}>
					{save.isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Save className="size-4" />
					)}
					{t("project.save", { defaultValue: "Save project" })}
				</Button>
			</div>
		</div>
	);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: control passed as children.
		<label className="block">
			<span className="mb-1.5 block font-medium text-foreground text-sm">
				{label}
			</span>
			{children}
		</label>
	);
}

function Select({
	value,
	onChange,
	children,
}: {
	value: string;
	onChange: (v: string) => void;
	children: ReactNode;
}) {
	return (
		<select
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className="h-11 w-full rounded-input border border-border bg-card px-3 text-foreground outline-none focus:border-brand-primary"
		>
			{children}
		</select>
	);
}
