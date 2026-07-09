import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	Activity,
	BookOpen,
	CheckCircle2,
	GraduationCap,
	Target,
	UserPlus,
	UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { EntityAnalyticsList } from "@/components/analytics/entity-analytics-list";
import {
	type StatTileData,
	StatTileGrid,
} from "@/components/analytics/stat-tile";
import { StudioShell } from "@/components/authoring/studio-shell";
import {
	type AdminAnalytics,
	type AnalyticsEntityType,
	analyticsKeys,
	type EntityAnalyticsRow,
	getAdminAnalytics,
	getInstructorAnalytics,
	type InstructorAnalytics,
} from "@/lib/analytics-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/instructor/analytics/")({
	component: () => <AnalyticsOverviewPage area="instructor" />,
});

export function AnalyticsOverviewPage({
	area,
}: {
	area: "instructor" | "admin";
}) {
	const { t } = useTranslation("authoring");
	const navigate = useNavigate();
	const [tab, setTab] = useState<AnalyticsEntityType>("course");

	const instructorQuery = useQuery({
		queryKey: analyticsKeys.instructor,
		queryFn: getInstructorAnalytics,
		enabled: area === "instructor",
	});
	const adminQuery = useQuery({
		queryKey: analyticsKeys.admin,
		queryFn: getAdminAnalytics,
		enabled: area === "admin",
	});
	const query = area === "admin" ? adminQuery : instructorQuery;
	const data = query.data;

	const tiles: StatTileData[] = useMemo(() => {
		if (area === "admin") {
			const p = (data as AdminAnalytics | undefined)?.platform;
			return [
				{
					key: "learners",
					icon: GraduationCap,
					value: p?.learners ?? null,
					label: t("analytics.learners"),
				},
				{
					key: "instructors",
					icon: UsersRound,
					value: p?.instructors ?? null,
					label: t("analytics.instructors"),
				},
				{
					key: "active",
					icon: Activity,
					value: p?.activeLearners7d ?? null,
					label: t("analytics.active_7d"),
				},
				{
					key: "new",
					icon: UserPlus,
					value: p?.newLearners30d ?? null,
					label: t("analytics.new_30d"),
				},
				{
					key: "enrol",
					icon: BookOpen,
					value: p?.enrollments ?? null,
					label: t("analytics.enrollments"),
				},
				{
					key: "done",
					icon: CheckCircle2,
					value: p?.completions ?? null,
					label: t("analytics.completions"),
				},
				{
					key: "rate",
					icon: Target,
					value: p ? `${p.completionRate}%` : null,
					label: t("analytics.completion_rate"),
				},
				{
					key: "courses",
					icon: BookOpen,
					value: p?.publishedCourses ?? null,
					label: t("admin.stats.published"),
				},
			];
		}
		const totals = (data as InstructorAnalytics | undefined)?.totals;
		return [
			{
				key: "reached",
				icon: UsersRound,
				value: totals?.learnersReached ?? null,
				label: t("analytics.learners_reached"),
			},
			{
				key: "enrol",
				icon: BookOpen,
				value: totals?.enrollments ?? null,
				label: t("analytics.enrollments"),
			},
			{
				key: "done",
				icon: CheckCircle2,
				value: totals?.completions ?? null,
				label: t("analytics.completions"),
			},
			{
				key: "rate",
				icon: Target,
				value: totals ? `${totals.completionRate}%` : null,
				label: t("analytics.completion_rate"),
			},
		];
	}, [area, data, t]);

	const tabs = useMemo(() => {
		const base: { type: AnalyticsEntityType; rows: EntityAnalyticsRow[] }[] = [
			{ type: "course", rows: data?.courses ?? [] },
			{ type: "path", rows: data?.paths ?? [] },
		];
		if (area === "admin") {
			base.push({
				type: "cohort",
				rows: (data as AdminAnalytics | undefined)?.cohorts ?? [],
			});
		}
		return base;
	}, [area, data]);

	const activeRows = tabs.find((x) => x.type === tab)?.rows ?? [];
	const entityLabel: Record<AnalyticsEntityType, string> = {
		course: t("analytics.course"),
		path: t("analytics.path"),
		cohort: t("analytics.cohort"),
	};
	const tabLabel: Record<AnalyticsEntityType, string> = {
		course: t("analytics.tab_courses"),
		path: t("analytics.tab_paths"),
		cohort: t("analytics.tab_cohorts"),
	};

	return (
		<StudioShell title={t("analytics.title")} area={area}>
			<div className="space-y-6">
				<div>
					<h2 className="font-display text-2xl text-foreground sm:text-3xl">
						{t("analytics.title")}
					</h2>
					<p className="mt-1 text-muted-foreground">
						{area === "admin"
							? t("analytics.subtitle_admin")
							: t("analytics.subtitle_instructor")}
					</p>
				</div>

				<StatTileGrid tiles={tiles} />

				<section className="rounded-card border border-border bg-card shadow-card">
					<div className="flex flex-col gap-3 border-border border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
						<p className="font-display text-foreground text-lg">
							{t("analytics.table_title")}
						</p>
						<div
							role="tablist"
							aria-label={t("analytics.table_title")}
							className="flex gap-1 self-start rounded-pill bg-muted p-1"
						>
							{tabs.map((entry) => (
								<button
									key={entry.type}
									type="button"
									role="tab"
									aria-selected={entry.type === tab}
									onClick={() => setTab(entry.type)}
									className={cn(
										"rounded-pill px-3 py-1.5 font-medium text-sm transition-colors",
										entry.type === tab
											? "bg-card text-brand-primary shadow-card"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{tabLabel[entry.type]}
									<span className="ml-1.5 font-stats text-xs opacity-70">
										{entry.rows.length}
									</span>
								</button>
							))}
						</div>
					</div>
					<EntityAnalyticsList
						rows={activeRows}
						entityLabel={entityLabel[tab]}
						showInstructor={area === "admin"}
						onOpen={(row) =>
							navigate({
								to:
									area === "admin"
										? "/admin/analytics/$entityType/$entityId"
										: "/instructor/analytics/$entityType/$entityId",
								params: { entityType: tab, entityId: row.id },
							})
						}
					/>
				</section>
			</div>
		</StudioShell>
	);
}
