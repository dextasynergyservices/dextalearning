import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowDown,
	ArrowUp,
	Loader2,
	Plus,
	Rocket,
	Trash2,
	UserPlus,
	X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { InlineCreate } from "@/components/authoring/inline-create";
import { IntroManager } from "@/components/authoring/intro-manager";
import { StudioShell } from "@/components/authoring/studio-shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
	addCohortCourse,
	addCohortPath,
	assignCohortFacilitator,
	assignCohortInstructor,
	type CohortDetail,
	type CohortStaff,
	createCohortIntro,
	deleteCohort,
	formatMoney,
	getCohort,
	publishCohort,
	removeCohortCourse,
	removeCohortFacilitator,
	removeCohortInstructor,
	removeCohortIntro,
	removeCohortPath,
	reorderCohortCourses,
	updateCohort,
} from "@/lib/content-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/cohorts/$cohortId")({
	component: CohortEditorPage,
});

const EXAM_MODES = ["unified", "rolling", "instructor", "deadline_bound"];
const UNLOCK_MODES = ["all_at_once", "progressive", "scheduled"];
const GROUPING_MODES = ["randomized", "skill_based", "balanced", "manual"];
const CURRENCIES = ["NGN", "USD", "GHS", "KES", "ZAR", "GBP", "EUR"];

function dateInput(iso: string | null): string {
	return iso ? iso.slice(0, 10) : "";
}

function CohortEditorPage() {
	const { cohortId } = Route.useParams();
	const { t } = useTranslation("authoring");
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [deleteOpen, setDeleteOpen] = useState(false);

	const { data: cohort, isPending } = useQuery({
		queryKey: ["cohort", cohortId],
		queryFn: () => getCohort(cohortId),
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["cohort", cohortId] });

	const publish = useMutation({
		mutationFn: () => publishCohort(cohortId),
		onSuccess: () => {
			invalidate();
			toast.success(t("cohorts.published", { defaultValue: "Cohort opened" }));
		},
		onError: (e) => toast.error(e.message),
	});

	const removeCohort = useMutation({
		mutationFn: () => deleteCohort(cohortId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["admin-cohorts"] });
			toast.success(t("cohorts.deleted", { defaultValue: "Cohort deleted" }));
			navigate({ to: "/admin/cohorts" });
		},
		onError: (e) => toast.error(e.message),
	});

	return (
		<StudioShell
			title={cohort?.title ?? "…"}
			area="admin"
			action={
				<div className="flex flex-wrap items-center justify-end gap-2">
					<span
						className={
							cohort?.status === "open" || cohort?.status === "active"
								? "badge-open"
								: "badge-soon"
						}
					>
						{t(`cohorts.status_${cohort?.status ?? "draft"}`, {
							defaultValue: cohort?.status ?? "draft",
						})}
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
						{t("cohorts.open_cta", { defaultValue: "Open" })}
					</Button>
				</div>
			}
		>
			{isPending || !cohort ? (
				<div className="space-y-4">
					<Skeleton className="h-56 rounded-card" />
					<Skeleton className="h-40 rounded-card" />
				</div>
			) : (
				<div className="space-y-6">
					<SettingsCard cohort={cohort} onSaved={invalidate} />
					<IntroManager
						id={cohort.id}
						intro={cohort.introLesson}
						editorArea="admin"
						queryKey={["cohort", cohortId]}
						createFn={createCohortIntro}
						removeFn={removeCohortIntro}
					/>
					<CourseManager cohort={cohort} onChanged={invalidate} />
					<PathManager cohort={cohort} onChanged={invalidate} />
					<StaffCard cohort={cohort} onChanged={invalidate} />
				</div>
			)}

			<ConfirmDialog
				open={deleteOpen}
				title={t("cohorts.delete_title", { defaultValue: "Delete cohort?" })}
				description={t("cohorts.delete_description", {
					defaultValue: "“{{title}}” will be removed.",
					title: cohort?.title ?? "",
				})}
				confirmLabel={t("courses.delete_confirm", { defaultValue: "Delete" })}
				cancelLabel={t("courses.delete_cancel", { defaultValue: "Cancel" })}
				isPending={removeCohort.isPending}
				tone="danger"
				onOpenChange={setDeleteOpen}
				onConfirm={() => removeCohort.mutate()}
			/>
		</StudioShell>
	);
}

function SettingsCard({
	cohort,
	onSaved,
}: {
	cohort: CohortDetail;
	onSaved: () => void;
}) {
	const { t } = useTranslation("authoring");
	const [form, setForm] = useState({
		description: cohort.description ?? "",
		startsAt: dateInput(cohort.startsAt),
		endsAt: dateInput(cohort.endsAt),
		capacity: cohort.capacity ? String(cohort.capacity) : "",
		isFeatured: cohort.isFeatured,
		isFree: cohort.isFree,
		price: String(cohort.price ?? 0),
		currency: cohort.currency ?? "NGN",
		earnBack: cohort.isEarnBackEligible,
		pct: String(cohort.earnBackPercentage ?? 100),
		examMode: cohort.examMode ?? "unified",
		unlockMode: cohort.unlockMode ?? "all_at_once",
		groupingMode: cohort.groupingMode ?? "randomized",
		targetGroupSize: String(cohort.targetGroupSize ?? 5),
		minGroupSize: String(cohort.minGroupSize ?? 3),
		maxGroupSize: String(cohort.maxGroupSize ?? 8),
	});
	const set = (patch: Partial<typeof form>) =>
		setForm((f) => ({ ...f, ...patch }));

	const save = useMutation({
		mutationFn: () =>
			updateCohort(cohort.id, {
				description: form.description.trim() || undefined,
				isFeatured: form.isFeatured,
				startsAt: form.startsAt || undefined,
				endsAt: form.endsAt || undefined,
				capacity: form.capacity ? Number(form.capacity) : undefined,
				isFree: form.isFree,
				price: form.isFree ? undefined : Number(form.price) || 0,
				currency: form.currency,
				isEarnBackEligible: form.isFree ? false : form.earnBack,
				earnBackPercentage:
					!form.isFree && form.earnBack ? Number(form.pct) || 100 : undefined,
				examMode: form.examMode,
				unlockMode: form.unlockMode,
				groupingMode: form.groupingMode,
				targetGroupSize: Number(form.targetGroupSize) || 5,
				minGroupSize: Number(form.minGroupSize) || 3,
				maxGroupSize: Number(form.maxGroupSize) || 8,
			}),
		onSuccess: () => {
			onSaved();
			toast.success(t("settings.saved", { defaultValue: "Settings saved" }));
		},
		onError: (e) => toast.error(e.message),
	});

	const earnBase = Math.round(
		((Number(form.price) || 0) *
			Math.min(100, Math.max(1, Number(form.pct) || 0))) /
			100,
	);

	return (
		<section className="rounded-card border border-border bg-card shadow-card">
			<header className="border-border border-b px-4 py-3 sm:px-6">
				<h2 className="font-display text-foreground text-lg">
					{t("cohorts.settings_title", { defaultValue: "Cohort settings" })}
				</h2>
			</header>
			<div className="space-y-5 p-4 sm:p-6">
				<Field
					label={t("settings.description", { defaultValue: "Description" })}
				>
					<textarea
						value={form.description}
						onChange={(e) => set({ description: e.target.value })}
						rows={2}
						className="w-full resize-none rounded-input border border-border px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-brand-primary"
					/>
				</Field>

				<div className="grid gap-4 sm:grid-cols-3">
					<Field label={t("cohorts.starts_at", { defaultValue: "Start date" })}>
						<input
							type="date"
							value={form.startsAt}
							onChange={(e) => set({ startsAt: e.target.value })}
							className="h-11 w-full rounded-input border border-border px-3 text-foreground outline-none focus:border-brand-primary"
						/>
					</Field>
					<Field label={t("cohorts.ends_at", { defaultValue: "End date" })}>
						<input
							type="date"
							value={form.endsAt}
							onChange={(e) => set({ endsAt: e.target.value })}
							className="h-11 w-full rounded-input border border-border px-3 text-foreground outline-none focus:border-brand-primary"
						/>
					</Field>
					<Field label={t("cohorts.capacity", { defaultValue: "Capacity" })}>
						<input
							type="number"
							min={1}
							value={form.capacity}
							placeholder={t("cohorts.unlimited", {
								defaultValue: "Unlimited",
							})}
							onChange={(e) => set({ capacity: e.target.value })}
							className="h-11 w-full rounded-input border border-border px-3.5 text-foreground outline-none focus:border-brand-primary"
						/>
					</Field>
				</div>

				<div className="rounded-card border border-brand-primary/20 bg-brand-primary-light/30 p-4">
					<Toggle
						checked={form.isFeatured}
						onChange={(on) => set({ isFeatured: on })}
						label={t("settings.featured", {
							defaultValue: "Feature on homepage",
						})}
						hint={t("settings.featured_hint", {
							defaultValue:
								"Show this in the Featured carousel on the homepage.",
						})}
					/>
				</div>

				{/* Pricing */}
				<div className="rounded-card border border-border p-4">
					<Toggle
						checked={!form.isFree}
						onChange={(on) => set({ isFree: !on })}
						label={t("settings.paid", { defaultValue: "Paid cohort" })}
					/>
					{!form.isFree ? (
						<div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]">
							<Field label={t("settings.price", { defaultValue: "Price" })}>
								<input
									type="number"
									min={0}
									value={form.price}
									onChange={(e) => set({ price: e.target.value })}
									className="h-11 w-full rounded-input border border-border px-3.5 text-foreground outline-none focus:border-brand-primary"
								/>
							</Field>
							<Field
								label={t("settings.currency", { defaultValue: "Currency" })}
							>
								<Select
									value={form.currency}
									onChange={(v) => set({ currency: v })}
									options={CURRENCIES}
								/>
							</Field>
						</div>
					) : null}
				</div>

				{/* Earn-Back */}
				{!form.isFree ? (
					<div className="rounded-card border border-brand-accent/30 bg-brand-accent-light/30 p-4">
						<Toggle
							checked={form.earnBack}
							onChange={(on) => set({ earnBack: on })}
							label={t("settings.earnback", { defaultValue: "Earn-Back" })}
						/>
						{form.earnBack ? (
							<div className="mt-4">
								<Field
									label={t("settings.earnback_pct", {
										defaultValue: "Earn-Back %",
									})}
								>
									<input
										type="number"
										min={1}
										max={100}
										value={form.pct}
										onChange={(e) => set({ pct: e.target.value })}
										className="h-11 w-full rounded-input border border-border px-3.5 text-foreground outline-none focus:border-brand-primary sm:max-w-40"
									/>
								</Field>
								<p className="mt-2 text-amber-800 text-sm">
									{t("settings.earnback_preview", {
										defaultValue:
											"Learners can earn back {{pct}}% — {{amount}} of {{price}}.",
										pct: Math.min(100, Math.max(1, Number(form.pct) || 0)),
										amount: formatMoney(form.currency, earnBase),
										price: formatMoney(form.currency, Number(form.price) || 0),
									})}
								</p>
							</div>
						) : null}
					</div>
				) : null}

				{/* Programme config */}
				<div className="grid gap-4 sm:grid-cols-3">
					<Field label={t("cohorts.exam_mode", { defaultValue: "Exam mode" })}>
						<Select
							value={form.examMode}
							onChange={(v) => set({ examMode: v })}
							options={EXAM_MODES}
							tPrefix="cohorts.exam"
						/>
					</Field>
					<Field
						label={t("cohorts.unlock_mode", { defaultValue: "Unlock mode" })}
					>
						<Select
							value={form.unlockMode}
							onChange={(v) => set({ unlockMode: v })}
							options={UNLOCK_MODES}
							tPrefix="cohorts.unlock"
						/>
					</Field>
					<Field
						label={t("cohorts.grouping_mode", { defaultValue: "Grouping" })}
					>
						<Select
							value={form.groupingMode}
							onChange={(v) => set({ groupingMode: v })}
							options={GROUPING_MODES}
							tPrefix="cohorts.group"
						/>
					</Field>
				</div>

				<div className="grid gap-4 sm:grid-cols-3">
					<Field
						label={t("cohorts.target_group", { defaultValue: "Target group" })}
					>
						<input
							type="number"
							min={2}
							value={form.targetGroupSize}
							onChange={(e) => set({ targetGroupSize: e.target.value })}
							className="h-11 w-full rounded-input border border-border px-3.5 text-foreground outline-none focus:border-brand-primary"
						/>
					</Field>
					<Field label={t("cohorts.min_group", { defaultValue: "Min group" })}>
						<input
							type="number"
							min={2}
							value={form.minGroupSize}
							onChange={(e) => set({ minGroupSize: e.target.value })}
							className="h-11 w-full rounded-input border border-border px-3.5 text-foreground outline-none focus:border-brand-primary"
						/>
					</Field>
					<Field label={t("cohorts.max_group", { defaultValue: "Max group" })}>
						<input
							type="number"
							min={2}
							value={form.maxGroupSize}
							onChange={(e) => set({ maxGroupSize: e.target.value })}
							className="h-11 w-full rounded-input border border-border px-3.5 text-foreground outline-none focus:border-brand-primary"
						/>
					</Field>
				</div>

				<div className="flex justify-end">
					<Button onClick={() => save.mutate()} disabled={save.isPending}>
						{save.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : null}
						{t("settings.save", { defaultValue: "Save settings" })}
					</Button>
				</div>
			</div>
		</section>
	);
}

function CourseManager({
	cohort,
	onChanged,
}: {
	cohort: CohortDetail;
	onChanged: () => void;
}) {
	const { t } = useTranslation("authoring");
	const [addId, setAddId] = useState("");

	const add = useMutation({
		mutationFn: (courseId: string) => addCohortCourse(cohort.id, courseId),
		onSuccess: () => {
			setAddId("");
			onChanged();
		},
		onError: (e) => toast.error(e.message),
	});
	const remove = useMutation({
		mutationFn: (courseId: string) => removeCohortCourse(cohort.id, courseId),
		onSuccess: onChanged,
		onError: (e) => toast.error(e.message),
	});
	const reorder = useMutation({
		mutationFn: (ids: string[]) => reorderCohortCourses(cohort.id, ids),
		onSuccess: onChanged,
		onError: (e) => toast.error(e.message),
	});

	const move = (index: number, dir: -1 | 1) => {
		const ids = cohort.courses.map((cc) => cc.course.id);
		const target = index + dir;
		if (target < 0 || target >= ids.length) return;
		[ids[index], ids[target]] = [ids[target], ids[index]];
		reorder.mutate(ids);
	};

	return (
		<section className="rounded-card border border-border bg-card shadow-card">
			<header className="border-border border-b px-4 py-3 sm:px-6">
				<h2 className="font-display text-foreground text-lg">
					{t("cohorts.courses_title", {
						defaultValue: "Courses in this cohort",
					})}
				</h2>
			</header>
			<ul className="divide-y divide-slate-100">
				{cohort.courses.map((cc, index) => (
					<li
						key={cc.course.id}
						className="flex items-center gap-2 px-3 py-2.5 sm:px-4"
					>
						<div className="flex flex-col">
							<button
								type="button"
								aria-label="Move up"
								disabled={index === 0 || reorder.isPending}
								onClick={() => move(index, -1)}
								className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-brand-primary disabled:opacity-30"
							>
								<ArrowUp className="size-3.5" />
							</button>
							<button
								type="button"
								aria-label="Move down"
								disabled={
									index === cohort.courses.length - 1 || reorder.isPending
								}
								onClick={() => move(index, 1)}
								className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-brand-primary disabled:opacity-30"
							>
								<ArrowDown className="size-3.5" />
							</button>
						</div>
						<span className="flex size-8 shrink-0 items-center justify-center rounded-btn bg-brand-primary-light font-stats font-semibold text-brand-primary text-xs">
							{index + 1}
						</span>
						<span className="flex-1 truncate font-medium text-foreground text-sm">
							{cc.course.title}
						</span>
						<button
							type="button"
							aria-label={t("editor.delete")}
							onClick={() => remove.mutate(cc.course.id)}
							className="flex size-8 items-center justify-center rounded-btn text-muted-foreground hover:bg-error/5 hover:text-error"
						>
							<Trash2 className="size-4" />
						</button>
					</li>
				))}
				{cohort.courses.length === 0 ? (
					<li className="px-4 py-8 text-center text-muted-foreground text-sm">
						{t("cohorts.no_courses", {
							defaultValue: "No courses yet — add one below.",
						})}
					</li>
				) : null}
			</ul>
			<div className="flex flex-col gap-2 border-border border-t p-3 sm:flex-row">
				<select
					value={addId}
					onChange={(e) => setAddId(e.target.value)}
					className="h-11 flex-1 rounded-input border border-border bg-card px-3 text-foreground outline-none focus:border-brand-primary"
				>
					<option value="">
						{cohort.availableCourses.length
							? t("cohorts.add_placeholder", {
									defaultValue: "Choose a course to add…",
								})
							: t("paths.no_available", {
									defaultValue: "No more courses to add",
								})}
					</option>
					{cohort.availableCourses.map((c) => (
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
					<Plus className="size-4" />
					{t("paths.add_course", { defaultValue: "Add course" })}
				</Button>
			</div>
			<div className="border-border border-t px-3 pb-3">
				<p className="mb-2 text-muted-foreground text-xs">
					{t("paths.or_create_course", {
						defaultValue: "Don't see it? Create a new draft course:",
					})}
				</p>
				<InlineCreate
					kind="course"
					attaching={add.isPending}
					onCreated={(courseId) => add.mutate(courseId)}
				/>
			</div>
		</section>
	);
}

/** Learning paths attached to a cohort (admin-only — §4.1). */
function PathManager({
	cohort,
	onChanged,
}: {
	cohort: CohortDetail;
	onChanged: () => void;
}) {
	const { t } = useTranslation("authoring");
	const [addId, setAddId] = useState("");

	const add = useMutation({
		mutationFn: (pathId: string) => addCohortPath(cohort.id, pathId),
		onSuccess: () => {
			setAddId("");
			onChanged();
		},
		onError: (e) => toast.error(e.message),
	});
	const remove = useMutation({
		mutationFn: (pathId: string) => removeCohortPath(cohort.id, pathId),
		onSuccess: onChanged,
		onError: (e) => toast.error(e.message),
	});

	return (
		<section className="rounded-card border border-border bg-card shadow-card">
			<header className="border-border border-b px-4 py-3 sm:px-6">
				<h2 className="font-display text-foreground text-lg">
					{t("cohorts.paths_title", { defaultValue: "Learning paths" })}
				</h2>
				<p className="mt-0.5 text-muted-foreground text-sm">
					{t("cohorts.paths_hint", {
						defaultValue:
							"Attach whole paths in addition to standalone courses.",
					})}
				</p>
			</header>
			<ul className="divide-y divide-slate-100">
				{cohort.paths.map((cp, index) => (
					<li
						key={cp.path.id}
						className="flex items-center gap-2 px-3 py-2.5 sm:px-4"
					>
						<span className="flex size-8 shrink-0 items-center justify-center rounded-btn bg-brand-accent-light font-stats font-semibold text-amber-700 text-xs">
							{index + 1}
						</span>
						<span className="flex-1 truncate font-medium text-foreground text-sm">
							{cp.path.title}
							{cp.path.status === "published" ? "" : " (draft)"}
						</span>
						<button
							type="button"
							aria-label={t("editor.delete")}
							onClick={() => remove.mutate(cp.path.id)}
							className="flex size-8 items-center justify-center rounded-btn text-muted-foreground hover:bg-error/5 hover:text-error"
						>
							<Trash2 className="size-4" />
						</button>
					</li>
				))}
				{cohort.paths.length === 0 ? (
					<li className="px-4 py-8 text-center text-muted-foreground text-sm">
						{t("cohorts.no_paths", {
							defaultValue: "No paths yet — add one below.",
						})}
					</li>
				) : null}
			</ul>
			<div className="flex flex-col gap-2 border-border border-t p-3 sm:flex-row">
				<select
					value={addId}
					onChange={(e) => setAddId(e.target.value)}
					className="h-11 flex-1 rounded-input border border-border bg-card px-3 text-foreground outline-none focus:border-brand-primary"
				>
					<option value="">
						{cohort.availablePaths.length
							? t("cohorts.add_path_placeholder", {
									defaultValue: "Choose a path to add…",
								})
							: t("cohorts.no_available_paths", {
									defaultValue: "No more paths to add",
								})}
					</option>
					{cohort.availablePaths.map((p) => (
						<option key={p.id} value={p.id}>
							{p.title}
							{p.status === "published" ? "" : " (draft)"}
						</option>
					))}
				</select>
				<Button
					variant="outline"
					disabled={!addId || add.isPending}
					onClick={() => addId && add.mutate(addId)}
				>
					<Plus className="size-4" />
					{t("cohorts.add_path", { defaultValue: "Add path" })}
				</Button>
			</div>
			<div className="border-border border-t px-3 pb-3">
				<p className="mb-2 text-muted-foreground text-xs">
					{t("paths.or_create_path", {
						defaultValue: "Don't see it? Create a new draft path:",
					})}
				</p>
				<InlineCreate
					kind="path"
					attaching={add.isPending}
					onCreated={(pathId) => add.mutate(pathId)}
				/>
			</div>
		</section>
	);
}

function StaffCard({
	cohort,
	onChanged,
}: {
	cohort: CohortDetail;
	onChanged: () => void;
}) {
	const { t } = useTranslation("authoring");
	return (
		<section className="grid gap-6 lg:grid-cols-2">
			<StaffColumn
				title={t("cohorts.instructors", { defaultValue: "Instructors" })}
				assigned={cohort.instructors.map((ci) => ci.user)}
				assignable={cohort.assignableInstructors}
				onAssign={(userId) => assignCohortInstructor(cohort.id, userId)}
				onRemove={(userId) => removeCohortInstructor(cohort.id, userId)}
				onChanged={onChanged}
			/>
			<StaffColumn
				title={t("cohorts.facilitators", { defaultValue: "Facilitators" })}
				assigned={cohort.facilitators.map((cf) => cf.user)}
				assignable={cohort.assignableFacilitators}
				onAssign={(userId) => assignCohortFacilitator(cohort.id, userId)}
				onRemove={(userId) => removeCohortFacilitator(cohort.id, userId)}
				onChanged={onChanged}
			/>
		</section>
	);
}

function StaffColumn({
	title,
	assigned,
	assignable,
	onAssign,
	onRemove,
	onChanged,
}: {
	title: string;
	assigned: CohortStaff[];
	assignable: CohortStaff[];
	onAssign: (userId: string) => Promise<unknown>;
	onRemove: (userId: string) => Promise<unknown>;
	onChanged: () => void;
}) {
	const { t } = useTranslation("authoring");
	const [pick, setPick] = useState("");
	const assign = useMutation({
		mutationFn: (userId: string) => onAssign(userId),
		onSuccess: () => {
			setPick("");
			onChanged();
		},
		onError: (e) => toast.error(e.message),
	});
	const remove = useMutation({
		mutationFn: (userId: string) => onRemove(userId),
		onSuccess: onChanged,
		onError: (e) => toast.error(e.message),
	});

	return (
		<div className="rounded-card border border-border bg-card shadow-card">
			<header className="border-border border-b px-4 py-3">
				<h3 className="font-display text-foreground">{title}</h3>
			</header>
			<ul className="divide-y divide-slate-100">
				{assigned.map((u) => (
					<li key={u.id} className="flex items-center gap-3 px-4 py-2.5">
						<span className="flex size-8 items-center justify-center rounded-full bg-brand-primary-light font-semibold text-brand-primary text-xs">
							{(u.name ?? "?").slice(0, 1).toUpperCase()}
						</span>
						<span className="min-w-0 flex-1">
							<span className="block truncate text-foreground text-sm">
								{u.name ?? u.email}
							</span>
						</span>
						<button
							type="button"
							aria-label={t("editor.delete")}
							onClick={() => remove.mutate(u.id)}
							className="flex size-7 items-center justify-center rounded-btn text-muted-foreground hover:bg-error/5 hover:text-error"
						>
							<X className="size-4" />
						</button>
					</li>
				))}
				{assigned.length === 0 ? (
					<li className="px-4 py-6 text-center text-muted-foreground text-sm">
						{t("cohorts.none_assigned", { defaultValue: "None assigned yet." })}
					</li>
				) : null}
			</ul>
			<div className="flex gap-2 border-border border-t p-3">
				<select
					value={pick}
					onChange={(e) => setPick(e.target.value)}
					className="h-10 flex-1 rounded-input border border-border bg-card px-3 text-foreground text-sm outline-none focus:border-brand-primary"
				>
					<option value="">
						{assignable.length
							? t("cohorts.choose_person", { defaultValue: "Choose a person…" })
							: t("cohorts.none_available", { defaultValue: "None available" })}
					</option>
					{assignable.map((u) => (
						<option key={u.id} value={u.id}>
							{u.name ?? u.email}
						</option>
					))}
				</select>
				<Button
					variant="ghost"
					size="sm"
					disabled={!pick || assign.isPending}
					onClick={() => pick && assign.mutate(pick)}
				>
					<UserPlus className="size-4" />
					{t("cohorts.assign", { defaultValue: "Assign" })}
				</Button>
			</div>
		</div>
	);
}

// ── Small form controls ─────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: control passed via children.
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
	options,
	tPrefix,
}: {
	value: string;
	onChange: (v: string) => void;
	options: string[];
	tPrefix?: string;
}) {
	const { t } = useTranslation("authoring");
	return (
		<select
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className="h-11 w-full rounded-input border border-border bg-card px-3 text-foreground outline-none focus:border-brand-primary"
		>
			{options.map((o) => (
				<option key={o} value={o}>
					{tPrefix
						? t(`${tPrefix}_${o}`, { defaultValue: o.replace(/_/g, " ") })
						: o}
				</option>
			))}
		</select>
	);
}

function Toggle({
	checked,
	onChange,
	label,
	hint,
}: {
	checked: boolean;
	onChange: (on: boolean) => void;
	label: string;
	hint?: string;
}) {
	return (
		<button
			type="button"
			onClick={() => onChange(!checked)}
			className="flex w-full items-center justify-between gap-3 text-left"
		>
			<span>
				<span className="block font-medium text-foreground text-sm">
					{label}
				</span>
				{hint ? (
					<span className="text-muted-foreground text-xs">{hint}</span>
				) : null}
			</span>
			<span
				className={cn(
					"relative h-6 w-11 shrink-0 rounded-full transition-colors",
					checked ? "bg-brand-primary" : "bg-slate-300",
				)}
			>
				<span
					className={cn(
						"absolute top-0.5 size-5 rounded-full bg-card shadow-sm transition-all",
						checked ? "left-[1.375rem]" : "left-0.5",
					)}
				/>
			</span>
		</button>
	);
}
