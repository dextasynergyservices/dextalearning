import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Target, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LearnerAnalyticsList } from "@/components/analytics/learner-analytics-list";
import { LearnerDetailModal } from "@/components/analytics/learner-detail-modal";
import {
	type StatTileData,
	StatTileGrid,
} from "@/components/analytics/stat-tile";
import { StudioShell } from "@/components/authoring/studio-shell";
import { CompletionFunnel } from "@/components/charts/completion-funnel";
import { Skeleton } from "@/components/ui/skeleton";
import {
	type AnalyticsEntityType,
	analyticsKeys,
	type EntityLearner,
	getEntityLearners,
	isAnalyticsEntityType,
} from "@/lib/analytics-api";

export const Route = createFileRoute(
	"/instructor/analytics/$entityType/$entityId",
)({
	component: () => <EntityAnalyticsDetailPage area="instructor" />,
});

export function EntityAnalyticsDetailPage({
	area,
}: {
	area: "instructor" | "admin";
}) {
	const { t } = useTranslation("authoring");
	// `strict: false` so this shared component works under BOTH the instructor
	// and admin route (each has its own $entityType/$entityId route).
	const params = useParams({ strict: false });
	const entityType = params.entityType ?? "";
	const entityId = params.entityId ?? "";
	const [selected, setSelected] = useState<EntityLearner | null>(null);

	const valid = isAnalyticsEntityType(entityType);
	const { data, isPending, isError, error } = useQuery({
		queryKey: analyticsKeys.learners(
			entityType as AnalyticsEntityType,
			entityId,
		),
		queryFn: () =>
			getEntityLearners(entityType as AnalyticsEntityType, entityId),
		enabled: valid,
	});

	const tiles: StatTileData[] = useMemo(() => {
		const learners = data?.learners ?? [];
		const total = learners.length;
		const completed = learners.filter((l) => l.isComplete).length;
		const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
		const avg =
			total > 0
				? Math.round(
						learners.reduce((s, l) => s + l.progressPercent, 0) / total,
					)
				: 0;
		return [
			{
				key: "enrolled",
				icon: UsersRound,
				value: data ? total : null,
				label: t("analytics.enrolled"),
			},
			{
				key: "completed",
				icon: CheckCircle2,
				value: data ? completed : null,
				label: t("analytics.completions"),
			},
			{
				key: "rate",
				icon: Target,
				value: data ? `${rate}%` : null,
				label: t("analytics.completion_rate"),
			},
			{
				key: "avg",
				icon: Target,
				value: data ? `${avg}%` : null,
				label: t("analytics.avg_progress"),
			},
		];
	}, [data, t]);

	const backTo =
		area === "admin" ? "/admin/analytics" : "/instructor/analytics";

	return (
		<StudioShell title={data?.entity.title ?? t("analytics.title")} area={area}>
			<div className="space-y-6">
				<Link
					to={backTo}
					className="inline-flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
				>
					<ArrowLeft className="size-4" />
					{t("analytics.back_to_analytics")}
				</Link>

				{!valid ? (
					<p className="rounded-card border border-border bg-card p-6 text-center text-muted-foreground shadow-card">
						{t("analytics.unknown_type")}
					</p>
				) : isError ? (
					<p className="rounded-card border border-border bg-card p-6 text-center text-error shadow-card">
						{error instanceof Error
							? error.message
							: t("analytics.learners_error")}
					</p>
				) : (
					<>
						<div>
							<p className="font-stats font-semibold text-brand-primary text-xs uppercase tracking-wide">
								{t(`analytics.${entityType}`)}
							</p>
							<h2 className="mt-0.5 font-display text-2xl text-foreground sm:text-3xl">
								{data?.entity.title ?? <Skeleton className="h-8 w-52" />}
							</h2>
						</div>

						<StatTileGrid tiles={tiles} />

						{/* Where learners drop off, before the who: funnel above roster. */}
						<CompletionFunnel
							entityType={entityType as AnalyticsEntityType}
							entityId={entityId}
						/>

						<section className="rounded-card border border-border bg-card shadow-card">
							<div className="flex items-center gap-2 border-border border-b px-4 py-4 sm:px-5">
								<UsersRound className="size-5 text-brand-primary" />
								<p className="font-display text-foreground text-lg">
									{t("analytics.enrolled_learners")}
								</p>
							</div>
							{isPending ? (
								<div className="space-y-2 p-4">
									<Skeleton className="h-12 rounded-btn" />
									<Skeleton className="h-12 rounded-btn" />
								</div>
							) : (
								<LearnerAnalyticsList
									learners={data?.learners ?? []}
									onOpen={setSelected}
								/>
							)}
						</section>
					</>
				)}
			</div>

			{selected && valid ? (
				<LearnerDetailModal
					type={entityType as AnalyticsEntityType}
					entityId={entityId}
					learnerId={selected.userId}
					learnerName={selected.name}
					onClose={() => setSelected(null)}
				/>
			) : null}
		</StudioShell>
	);
}
