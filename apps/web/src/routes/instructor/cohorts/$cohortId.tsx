import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	BookOpen,
	CheckCircle2,
	ChevronLeft,
	ClipboardCheck,
	FolderKanban,
	Lock,
	Waypoints,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { RiskBadge } from "@/components/authoring/risk-badge";
import { StudioShell } from "@/components/authoring/studio-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getTeachingCohortDetail, teachingKeys } from "@/lib/teaching-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/instructor/cohorts/$cohortId")({
	component: InstructorCohortDetailPage,
});

function initials(name: string): string {
	return (
		name
			.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? "")
			.join("") || "?"
	);
}

function InstructorCohortDetailPage() {
	const { cohortId } = Route.useParams();
	const { t } = useTranslation("authoring");
	const { data, isPending } = useQuery({
		queryKey: teachingKeys.detail(cohortId),
		queryFn: () => getTeachingCohortDetail(cohortId),
	});

	return (
		<StudioShell title={data?.title ?? "…"} area="instructor">
			<div className="space-y-5">
				<Link
					to="/instructor/cohorts"
					className="inline-flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
				>
					<ChevronLeft className="size-4" />
					{t("teaching.back", { defaultValue: "Cohorts you teach" })}
				</Link>

				{isPending || !data ? (
					<>
						<Skeleton className="h-24 rounded-card" />
						<Skeleton className="h-64 rounded-card" />
					</>
				) : (
					<>
						<section className="rounded-card border border-border bg-card p-5 shadow-card">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<h2 className="font-display text-foreground text-xl">
									{data.title}
								</h2>
								<span className="inline-flex items-center gap-1 rounded-pill bg-muted px-2.5 py-1 font-medium text-muted-foreground text-xs">
									<Lock className="size-3" />
									{t("teaching.read_only", { defaultValue: "Read-only" })}
								</span>
							</div>
							<div className="mt-3 flex flex-wrap gap-2">
								<Stat
									icon={BookOpen}
									label={t("teaching.courses", {
										count: data.courses.length,
										defaultValue: "{{count}} courses",
									})}
								/>
								<Stat
									icon={Waypoints}
									label={t("teaching.paths", {
										count: data.paths.length,
										defaultValue: "{{count}} paths",
									})}
								/>
								<Stat
									icon={ClipboardCheck}
									label={t("teaching.assessments", {
										count: data.assessmentCount,
										defaultValue: "{{count}} assessments",
									})}
								/>
								<Stat
									icon={FolderKanban}
									label={t("teaching.projects", {
										count: data.projectCount,
										defaultValue: "{{count}} projects",
									})}
								/>
							</div>
						</section>

						<section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
							<header className="flex items-center justify-between gap-2 border-border border-b px-4 py-3">
								<h3 className="font-display text-foreground">
									{t("teaching.roster", { defaultValue: "Learners" })}
								</h3>
								<span className="rounded-pill bg-muted px-2 py-0.5 font-stats text-muted-foreground text-xs">
									{data.learners.length}
								</span>
							</header>
							{data.learners.length === 0 ? (
								<p className="px-4 py-8 text-center text-muted-foreground text-sm">
									{t("teaching.no_learners", {
										defaultValue: "No learners enrolled yet.",
									})}
								</p>
							) : (
								<ul className="divide-y divide-border">
									{data.learners.map((learner) => (
										<li
											key={learner.userId}
											className="flex items-center gap-3 px-4 py-3"
										>
											<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-primary-light font-semibold text-brand-primary text-xs">
												{initials(learner.name)}
											</span>
											<div className="min-w-0 flex-1">
												<p className="truncate font-medium text-foreground text-sm">
													{learner.name}
												</p>
												<p className="truncate text-muted-foreground text-xs">
													{learner.email}
												</p>
											</div>
											{learner.risk ? <RiskBadge risk={learner.risk} /> : null}
											<div className="flex w-28 shrink-0 items-center gap-2">
												<span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
													<span
														className={cn(
															"block h-full rounded-full",
															learner.completed
																? "bg-success"
																: "bg-brand-primary",
														)}
														style={{ width: `${learner.progressPercent}%` }}
													/>
												</span>
												{learner.completed ? (
													<CheckCircle2 className="size-4 shrink-0 text-success" />
												) : (
													<span className="w-8 shrink-0 text-right font-stats text-muted-foreground text-xs">
														{learner.progressPercent}%
													</span>
												)}
											</div>
										</li>
									))}
								</ul>
							)}
						</section>
					</>
				)}
			</div>
		</StudioShell>
	);
}

function Stat({ icon: Icon, label }: { icon: typeof BookOpen; label: string }) {
	return (
		<span className="inline-flex items-center gap-1.5 rounded-btn border border-border px-2.5 py-1.5 text-muted-foreground text-xs">
			<Icon className="size-3.5 text-brand-primary" />
			{label}
		</span>
	);
}
