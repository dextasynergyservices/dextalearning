import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	CheckCircle2,
	ChevronRight,
	PlayCircle,
	Trophy,
	Waypoints,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { LearnerShell } from "@/components/layout/learner-shell";
import { ProgressRing } from "@/components/learn/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { getPathProgress, type PathProgress } from "@/lib/content-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/learn/path/$pathId")({
	component: PathProgressRoute,
});

function PathProgressRoute() {
	const { pathId } = Route.useParams();
	const { t } = useTranslation("authoring");
	const { data, isPending } = useQuery({
		queryKey: ["path-progress", pathId],
		queryFn: () => getPathProgress(pathId),
	});

	return (
		<LearnerShell
			title={data?.path.title ?? t("hub.path_title", { defaultValue: "Path" })}
		>
			<div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
				{isPending || !data ? (
					<>
						<Skeleton className="h-28 rounded-card" />
						<Skeleton className="h-40 rounded-card" />
					</>
				) : (
					<PathBody data={data} />
				)}
			</div>
		</LearnerShell>
	);
}

function PathBody({ data }: { data: PathProgress }) {
	const { t } = useTranslation("authoring");
	const s = data.summary;
	const nextCourse = data.courses.find((c) => !c.isComplete);

	return (
		<>
			<section
				className={cn(
					"rounded-card border p-5 shadow-card",
					s.isComplete
						? "border-success/30 bg-success/5"
						: "border-border bg-card",
				)}
			>
				<div className="flex items-center gap-4">
					<ProgressRing value={s.percent} complete={s.isComplete} size={76} />
					<div className="min-w-0 flex-1">
						<p className="flex items-center gap-1.5 font-stats font-semibold text-brand-primary text-xs uppercase">
							<Waypoints className="size-3.5" />
							{t("hub.path_eyebrow", { defaultValue: "Learning path" })}
						</p>
						<h1 className="mt-1 font-display text-foreground text-xl leading-tight">
							{data.path.title}
						</h1>
						<p className="mt-1 text-muted-foreground text-sm">
							{t("hub.path_progress", {
								defaultValue: "{{done}}/{{total}} courses complete",
								done: s.coursesComplete,
								total: s.coursesTotal,
								n: s.percent,
							})}
						</p>
					</div>
				</div>

				{s.isComplete ? (
					<div className="mt-4 flex items-center justify-center gap-1.5 rounded-btn bg-success py-2.5 font-medium text-sm text-white">
						<Trophy className="size-4" />
						{t("hub.complete", { defaultValue: "Complete!" })}
					</div>
				) : nextCourse ? (
					<Link
						to="/learn/course/$courseId"
						params={{ courseId: nextCourse.id }}
						className="mt-4 flex items-center justify-center gap-2 rounded-btn bg-brand-primary py-2.5 font-semibold text-sm text-white transition-colors hover:bg-brand-primary-hover"
					>
						<PlayCircle className="size-4" />
						{t("hub.continue", { defaultValue: "Continue learning" })}
					</Link>
				) : null}
			</section>

			<section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
				<h2 className="bg-muted px-4 py-3 font-display text-foreground">
					{t("hub.courses", { defaultValue: "Courses" })}
				</h2>
				<div className="divide-y divide-slate-100">
					{data.courses.map((course, i) => (
						<Link
							key={course.id}
							to="/learn/course/$courseId"
							params={{ courseId: course.id }}
							className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent"
						>
							{course.isComplete ? (
								<CheckCircle2 className="size-7 shrink-0 text-success" />
							) : (
								<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 font-stats font-bold text-brand-primary text-xs">
									{i + 1}
								</span>
							)}
							<span className="min-w-0 flex-1">
								<span className="block truncate font-medium text-foreground text-sm">
									{course.title}
								</span>
								<span className="mt-1.5 flex items-center gap-2">
									<span className="flex h-1.5 max-w-[10rem] flex-1 overflow-hidden rounded-full bg-muted">
										<span
											className={cn(
												"h-full rounded-full",
												course.isComplete ? "bg-success" : "bg-brand-primary",
											)}
											style={{ width: `${course.percent}%` }}
										/>
									</span>
									<span className="font-stats text-muted-foreground text-xs">
										{course.percent}%
									</span>
									{!course.isRequired ? (
										<span className="text-muted-foreground text-xs">
											· {t("hub.optional", { defaultValue: "Optional" })}
										</span>
									) : null}
								</span>
							</span>
							<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
						</Link>
					))}
				</div>
			</section>
		</>
	);
}
