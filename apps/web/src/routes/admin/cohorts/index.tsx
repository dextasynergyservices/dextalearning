import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
	BookOpen,
	CalendarDays,
	Loader2,
	Plus,
	Trash2,
	Users,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { StudioShell } from "@/components/authoring/studio-shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
	type CohortSummary,
	createCohort,
	deleteCohort,
	formatMoney,
	listCohorts,
} from "@/lib/content-api";

export const Route = createFileRoute("/admin/cohorts/")({
	component: CohortsListPage,
});

const STATUS_BADGE: Record<string, string> = {
	open: "badge-open",
	active: "badge-open",
	draft: "badge-soon",
	closed: "badge-soon",
};

function formatDate(iso: string | null): string | null {
	if (!iso) return null;
	return new Date(iso).toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function CohortsListPage() {
	const { t } = useTranslation("authoring");
	const queryClient = useQueryClient();
	const [title, setTitle] = useState("");
	const [creating, setCreating] = useState(false);
	const [toDelete, setToDelete] = useState<CohortSummary | null>(null);

	const { data: cohorts, isPending } = useQuery({
		queryKey: ["admin-cohorts"],
		queryFn: listCohorts,
	});

	const create = useMutation({
		mutationFn: () => createCohort({ title: title.trim() }),
		onSuccess: () => {
			setTitle("");
			setCreating(false);
			queryClient.invalidateQueries({ queryKey: ["admin-cohorts"] });
		},
		onError: (e) => toast.error(e.message),
	});

	const remove = useMutation({
		mutationFn: (id: string) => deleteCohort(id),
		onSuccess: () => {
			setToDelete(null);
			queryClient.invalidateQueries({ queryKey: ["admin-cohorts"] });
			toast.success(t("cohorts.deleted", { defaultValue: "Cohort deleted" }));
		},
		onError: (e) => toast.error(e.message),
	});

	const open = cohorts?.filter((c) => c.status === "open").length ?? 0;

	return (
		<StudioShell
			title={t("cohorts.title", { defaultValue: "Cohorts" })}
			area="admin"
			action={
				<Button size="sm" onClick={() => setCreating((v) => !v)}>
					<Plus className="size-4" />
					{t("cohorts.new", { defaultValue: "New cohort" })}
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
					<p className="font-stats font-semibold text-brand-primary text-xs uppercase">
						{t("cohorts.eyebrow", { defaultValue: "Run programmes" })}
					</p>
					<h2 className="mt-2 font-display text-2xl text-slate-900 sm:text-3xl">
						{t("cohorts.heading", { defaultValue: "Cohorts" })}
					</h2>
					<p className="mt-2 max-w-2xl text-slate-600 text-sm leading-relaxed">
						{t("cohorts.subtitle", {
							defaultValue:
								"Schedule a guided run of courses with a start date, seats, groups and assigned staff.",
						})}
					</p>
					<div className="mt-4 flex gap-6 text-sm">
						<span className="text-slate-500">
							<b className="font-stats font-bold text-slate-900 text-lg">
								{isPending ? "—" : (cohorts?.length ?? 0)}
							</b>{" "}
							{t("cohorts.stat_total", { defaultValue: "cohorts" })}
						</span>
						<span className="text-slate-500">
							<b className="font-stats font-bold text-slate-900 text-lg">
								{isPending ? "—" : open}
							</b>{" "}
							{t("cohorts.stat_open", { defaultValue: "open" })}
						</span>
					</div>
				</motion.section>

				{creating ? (
					<form
						onSubmit={(e) => {
							e.preventDefault();
							if (title.trim().length >= 3) create.mutate();
						}}
						className="flex flex-col gap-3 rounded-card border border-slate-200 bg-white p-4 shadow-card sm:flex-row sm:items-center"
					>
						<input
							// biome-ignore lint/a11y/noAutofocus: focus the field the user just opened.
							autoFocus
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder={t("cohorts.field_title", {
								defaultValue: "Cohort title",
							})}
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
							{t("cohorts.create", { defaultValue: "Create cohort" })}
						</Button>
					</form>
				) : null}

				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{isPending ? (
						["a", "b", "c"].map((k) => (
							<Skeleton key={k} className="h-40 rounded-card" />
						))
					) : cohorts && cohorts.length > 0 ? (
						cohorts.map((cohort) => (
							<motion.article
								key={cohort.id}
								whileHover={{ y: -4 }}
								className="group flex flex-col rounded-card border border-slate-200 bg-white shadow-card transition-colors hover:border-brand-primary/30 hover:shadow-card-hover"
							>
								<Link
									to="/admin/cohorts/$cohortId"
									params={{ cohortId: cohort.id }}
									className="flex flex-1 flex-col p-4"
								>
									<div className="flex items-start justify-between gap-2">
										<span className="flex size-11 shrink-0 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
											<CalendarDays className="size-5" />
										</span>
										<span
											className={
												STATUS_BADGE[cohort.status ?? "draft"] ?? "badge-soon"
											}
										>
											{t(`cohorts.status_${cohort.status ?? "draft"}`, {
												defaultValue: cohort.status ?? "draft",
											})}
										</span>
									</div>
									<h3 className="mt-3 line-clamp-2 font-display text-slate-900">
										{cohort.title}
									</h3>
									<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400 text-xs">
										{formatDate(cohort.startsAt) ? (
											<span className="flex items-center gap-1">
												<CalendarDays className="size-3.5" />
												{formatDate(cohort.startsAt)}
											</span>
										) : null}
										<span className="flex items-center gap-1">
											<BookOpen className="size-3.5" />
											{cohort._count.courses}
										</span>
										<span className="flex items-center gap-1">
											<Users className="size-3.5" />
											{cohort.seatsFilled}
											{cohort.capacity ? `/${cohort.capacity}` : ""}
										</span>
									</div>
									<p className="mt-3 font-stats font-bold text-slate-900 text-sm">
										{cohort.isFree
											? t("catalog.free", {
													ns: "academy",
													defaultValue: "Free",
												})
											: formatMoney(cohort.currency, cohort.price ?? 0)}
									</p>
								</Link>
								<div className="flex items-center justify-end border-slate-100 border-t px-3 py-2">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setToDelete(cohort)}
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
							<CalendarDays className="mx-auto size-8 text-slate-300" />
							<p className="mt-3 text-slate-400">
								{t("cohorts.empty", {
									defaultValue: "No cohorts yet — schedule your first run.",
								})}
							</p>
						</div>
					)}
				</div>
			</div>

			<ConfirmDialog
				open={Boolean(toDelete)}
				title={t("cohorts.delete_title", { defaultValue: "Delete cohort?" })}
				description={t("cohorts.delete_description", {
					defaultValue: "“{{title}}” will be removed.",
					title: toDelete?.title ?? "",
				})}
				confirmLabel={t("courses.delete_confirm", { defaultValue: "Delete" })}
				cancelLabel={t("courses.delete_cancel", { defaultValue: "Cancel" })}
				isPending={remove.isPending}
				tone="danger"
				onOpenChange={(o) => !o && setToDelete(null)}
				onConfirm={() => toDelete && remove.mutate(toDelete.id)}
			/>
		</StudioShell>
	);
}
