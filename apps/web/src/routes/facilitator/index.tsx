import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Layers, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FacilitatorShell } from "@/components/layout/facilitator-shell";
import { Skeleton } from "@/components/ui/skeleton";
import {
	facilitatorKeys,
	getMyFacilitatedCohorts,
} from "@/lib/facilitator-api";

export const Route = createFileRoute("/facilitator/")({
	component: FacilitatorHome,
});

function FacilitatorHome() {
	const { t } = useTranslation("facilitator");
	const { data, isPending } = useQuery({
		queryKey: facilitatorKeys.cohorts,
		queryFn: getMyFacilitatedCohorts,
	});

	return (
		<FacilitatorShell title={t("my_cohorts", { defaultValue: "Your cohorts" })}>
			{isPending ? (
				<div className="grid gap-3 sm:grid-cols-2">
					<Skeleton className="h-28 rounded-card" />
					<Skeleton className="h-28 rounded-card" />
				</div>
			) : !data || data.length === 0 ? (
				<div className="rounded-card border border-border border-dashed bg-card p-10 text-center">
					<UsersRound className="mx-auto size-8 text-muted-foreground" />
					<p className="mt-3 font-display text-foreground">
						{t("empty_title", { defaultValue: "No cohorts to facilitate yet" })}
					</p>
					<p className="mt-1 text-muted-foreground text-sm">
						{t("empty_body", {
							defaultValue:
								"When an admin assigns you as a facilitator, your cohorts appear here.",
						})}
					</p>
				</div>
			) : (
				<div className="grid gap-3 sm:grid-cols-2">
					{data.map((cohort) => (
						<Link
							key={cohort.id}
							to="/facilitator/cohorts/$cohortId"
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
										<UsersRound className="size-3.5" />
										{t("learners", {
											count: cohort.learnerCount,
											defaultValue: "{{count}} learners",
										})}
									</span>
									<span className="inline-flex items-center gap-1">
										<Layers className="size-3.5" />
										{t("groups", {
											count: cohort.groupCount,
											defaultValue: "{{count}} groups",
										})}
									</span>
								</div>
							</div>
							<ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
						</Link>
					))}
				</div>
			)}
		</FacilitatorShell>
	);
}
