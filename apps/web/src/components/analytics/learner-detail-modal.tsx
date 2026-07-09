import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Loader2, X } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CompletionBar } from "@/components/analytics/completion-bar";
import {
	type AnalyticsEntityType,
	analyticsKeys,
	getLearnerDetail,
} from "@/lib/analytics-api";
import { cn } from "@/lib/utils";

/**
 * ONE learner's performance inside one entity (§2.4 per-student drill-down).
 * Course → lesson-by-lesson (completed + post-quiz score) + assessment best
 * scores. Path/cohort → per-component progress. Mobile: bottom sheet;
 * desktop: centered modal.
 */
export function LearnerDetailModal({
	type,
	entityId,
	learnerId,
	learnerName,
	onClose,
}: {
	type: AnalyticsEntityType;
	entityId: string;
	learnerId: string;
	learnerName: string;
	onClose: () => void;
}) {
	const { t } = useTranslation("authoring");
	const { data, isPending, isError, error } = useQuery({
		queryKey: analyticsKeys.learnerDetail(type, entityId, learnerId),
		queryFn: () => getLearnerDetail(type, entityId, learnerId),
	});

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [onClose]);

	return (
		<div
			className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:px-3 sm:py-4"
			role="presentation"
		>
			<button
				type="button"
				aria-label={t("common.close", { defaultValue: "Close" })}
				onClick={onClose}
				className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
			/>
			<section
				aria-labelledby="learner-detail-title"
				aria-modal="true"
				role="dialog"
				className="relative flex max-h-[88dvh] w-full flex-col rounded-t-card border border-border bg-popover shadow-[0_20px_60px_rgba(15,23,42,0.18)] sm:max-w-lg sm:rounded-card"
			>
				<div className="flex items-start gap-3 border-border border-b px-4 py-4 sm:px-5">
					<div className="min-w-0 flex-1">
						<p className="font-stats font-semibold text-brand-primary text-xs uppercase tracking-wide">
							{t("analytics.student_performance")}
						</p>
						<h2
							id="learner-detail-title"
							className="mt-0.5 truncate font-display text-foreground text-lg"
						>
							{learnerName}
						</h2>
						{data ? (
							<p className="mt-0.5 truncate text-muted-foreground text-sm">
								{data.entity.title}
							</p>
						) : null}
					</div>
					<button
						type="button"
						aria-label={t("common.close", { defaultValue: "Close" })}
						onClick={onClose}
						className="flex size-9 shrink-0 items-center justify-center rounded-btn text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						<X className="size-4" />
					</button>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[env(safe-area-inset-bottom)] sm:p-5">
					{isPending ? (
						<div className="flex h-32 items-center justify-center">
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					) : isError ? (
						<p className="px-4 py-8 text-center text-error text-sm">
							{error instanceof Error
								? error.message
								: t("analytics.learners_error")}
						</p>
					) : data ? (
						<div className="space-y-5">
							{/* Overall */}
							<div className="rounded-card border border-border bg-card p-4">
								<div className="flex items-center justify-between gap-3">
									<span className="font-stats font-semibold text-muted-foreground text-xs uppercase tracking-wide">
										{t("analytics.overall_progress")}
									</span>
									{data.learner.isComplete ? (
										<span className="inline-flex items-center gap-1 font-medium text-success text-xs">
											<CheckCircle2 className="size-3.5" />
											{t("analytics.completed_state")}
										</span>
									) : null}
								</div>
								<CompletionBar
									value={data.learner.progressPercent}
									tone={data.learner.isComplete ? "success" : "primary"}
									className="mt-2"
								/>
							</div>

							{/* Course: lessons */}
							{data.lessons ? (
								<Section title={t("analytics.lessons")}>
									{data.lessons.length === 0 ? (
										<Empty label={t("analytics.no_lessons")} />
									) : (
										<ul className="divide-y divide-border/60">
											{data.lessons.map((lesson) => (
												<li
													key={lesson.id}
													className="flex items-center gap-3 py-2.5"
												>
													{lesson.completed ? (
														<CheckCircle2 className="size-4 shrink-0 text-success" />
													) : (
														<Circle className="size-4 shrink-0 text-muted-foreground/50" />
													)}
													<span
														className={cn(
															"min-w-0 flex-1 truncate text-sm",
															lesson.completed
																? "text-foreground"
																: "text-muted-foreground",
														)}
													>
														{lesson.title}
													</span>
													{lesson.postQuizScore != null ? (
														<span className="font-stats font-semibold text-foreground text-sm tabular-nums">
															{lesson.postQuizScore}%
														</span>
													) : null}
												</li>
											))}
										</ul>
									)}
								</Section>
							) : null}

							{/* Course: assessments */}
							{data.assessments && data.assessments.length > 0 ? (
								<Section title={t("analytics.assessments")}>
									<ul className="divide-y divide-border/60">
										{data.assessments.map((a) => (
											<li key={a.id} className="flex items-center gap-3 py-2.5">
												<span className="min-w-0 flex-1 truncate text-foreground text-sm">
													{a.title}
												</span>
												{a.bestScore != null ? (
													<span
														className={cn(
															"font-stats font-semibold text-sm tabular-nums",
															a.passed ? "text-success" : "text-foreground",
														)}
													>
														{a.bestScore}%
													</span>
												) : (
													<span className="text-muted-foreground text-xs">
														{t("analytics.not_attempted")}
													</span>
												)}
											</li>
										))}
									</ul>
								</Section>
							) : null}

							{/* Path/cohort: components */}
							{data.components ? (
								<Section title={t("analytics.components")}>
									{data.components.length === 0 ? (
										<Empty label={t("analytics.no_components")} />
									) : (
										<ul className="space-y-3">
											{data.components.map((c) => (
												<li key={`${c.type}-${c.id}`}>
													<div className="flex items-center justify-between gap-2">
														<span className="truncate font-medium text-foreground text-sm">
															{c.title}
														</span>
														{c.isComplete ? (
															<CheckCircle2 className="size-4 shrink-0 text-success" />
														) : null}
													</div>
													<CompletionBar
														value={c.progressPercent}
														tone={c.isComplete ? "success" : "primary"}
														className="mt-1"
													/>
												</li>
											))}
										</ul>
									)}
								</Section>
							) : null}
						</div>
					) : null}
				</div>
			</section>
		</div>
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div>
			<p className="mb-1.5 font-stats font-semibold text-muted-foreground text-xs uppercase tracking-wide">
				{title}
			</p>
			{children}
		</div>
	);
}

function Empty({ label }: { label: string }) {
	return <p className="py-3 text-muted-foreground text-sm">{label}</p>;
}
