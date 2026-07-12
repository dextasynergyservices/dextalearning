import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Info, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AtRiskPill } from "@/components/authoring/risk-badge";
import { StudioShell } from "@/components/authoring/studio-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyTeachingCohorts, teachingKeys } from "@/lib/teaching-api";

export const Route = createFileRoute("/instructor/cohorts/")({
	component: InstructorCohortsPage,
});

function InstructorCohortsPage() {
	const { t } = useTranslation("authoring");
	const { data, isPending } = useQuery({
		queryKey: teachingKeys.list,
		queryFn: getMyTeachingCohorts,
	});

	return (
		<StudioShell
			title={t("teaching.title", { defaultValue: "Cohorts you teach" })}
			area="instructor"
		>
			<div className="space-y-5">
				<div>
					<h2 className="font-display text-foreground text-xl">
						{t("teaching.title", { defaultValue: "Cohorts you teach" })}
					</h2>
					<div className="mt-2 flex items-start gap-2 rounded-card border border-border bg-muted/40 px-4 py-3 text-muted-foreground text-sm">
						<Info className="mt-0.5 size-4 shrink-0 text-brand-primary" />
						<p>
							{t("teaching.subtitle", {
								defaultValue:
									"Cohorts an admin has assigned you to teach. You get read-only visibility to monitor and support learners — group management stays with facilitators, and settings with admins.",
							})}
						</p>
					</div>
				</div>

				{isPending ? (
					<div className="grid gap-3 sm:grid-cols-2">
						<Skeleton className="h-24 rounded-card" />
						<Skeleton className="h-24 rounded-card" />
					</div>
				) : !data || data.length === 0 ? (
					<div className="rounded-card border border-border border-dashed bg-card p-10 text-center">
						<CalendarDays className="mx-auto size-8 text-muted-foreground" />
						<p className="mt-3 font-display text-foreground">
							{t("teaching.empty_title", {
								defaultValue: "No cohorts assigned yet",
							})}
						</p>
						<p className="mt-1 text-muted-foreground text-sm">
							{t("teaching.empty_body", {
								defaultValue:
									"When an admin assigns you to teach a cohort, it appears here.",
							})}
						</p>
					</div>
				) : (
					<div className="grid gap-3 sm:grid-cols-2">
						{data.map((cohort) => (
							<Link
								key={cohort.id}
								to="/instructor/cohorts/$cohortId"
								params={{ cohortId: cohort.id }}
								className="group flex items-center gap-4 rounded-card border border-border bg-card p-4 shadow-card transition-colors hover:border-brand-primary"
							>
								<span className="flex size-11 shrink-0 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
									<CalendarDays className="size-5" />
								</span>
								<div className="min-w-0 flex-1">
									<p className="truncate font-display text-foreground">
										{cohort.title}
									</p>
									<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
										<span className="inline-flex items-center gap-1">
											<Users className="size-3.5" />
											{t("teaching.learners", {
												count: cohort.learnerCount,
												defaultValue: "{{count}} learners",
											})}
										</span>
										<span>
											{t("teaching.courses", {
												count: cohort.courseCount,
												defaultValue: "{{count}} courses",
											})}
										</span>
										<AtRiskPill count={cohort.atRiskCount} />
									</div>
								</div>
								<ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
							</Link>
						))}
					</div>
				)}
			</div>
		</StudioShell>
	);
}
