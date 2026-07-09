import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
	ArrowLeft,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Circle,
	ClipboardCheck,
	ListChecks,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { RequireAuth } from "@/components/auth/require-auth";
import { NextSessionPrompt } from "@/components/engagement/next-session-prompt";
import { InlineQuiz } from "@/components/learn/inline-quiz";
import { LessonListPanel } from "@/components/learn/lesson-list-panel";
import { LessonPlayer } from "@/components/player/lesson-player";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	getLessonContext,
	type LessonContext,
	reportLessonProgress,
} from "@/lib/content-api";
import { engagementKeys } from "@/lib/engagement-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/learn/lesson/$lessonId")({
	component: LessonRoute,
});

function LessonRoute() {
	const { lessonId } = Route.useParams();
	return (
		<RequireAuth>
			<LessonView lessonId={lessonId} />
		</RequireAuth>
	);
}

function LessonView({ lessonId }: { lessonId: string }) {
	const navigate = useNavigate();
	const { t } = useTranslation("authoring");
	const [listOpen, setListOpen] = useState(false);
	const { data: ctx, isPending } = useQuery({
		queryKey: ["lesson-context", lessonId],
		queryFn: () => getLessonContext(lessonId),
	});

	const go = (id: string) => {
		setListOpen(false);
		navigate({ to: "/learn/lesson/$lessonId", params: { lessonId: id } });
	};
	const doneCount = ctx ? ctx.lessons.filter((l) => l.done).length : 0;

	return (
		<div className="min-h-dvh bg-muted">
			<header className="sticky top-0 z-10 border-border border-b bg-card/90 backdrop-blur">
				<div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
					<button
						type="button"
						onClick={() =>
							ctx
								? navigate({
										to: "/learn/course/$courseId",
										params: { courseId: ctx.course.id },
									})
								: navigate({ to: "/dashboard" })
						}
						className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
					>
						<ArrowLeft className="size-4 shrink-0" />
						<span className="truncate">{ctx?.course.title ?? "Back"}</span>
					</button>
					<div className="flex shrink-0 items-center gap-3">
						{ctx ? (
							<span className="font-stats text-muted-foreground text-xs">
								{ctx.position.index}/{ctx.position.total}
							</span>
						) : null}
						{ctx ? (
							<button
								type="button"
								onClick={() => setListOpen(true)}
								className="flex items-center gap-1.5 rounded-btn bg-muted px-3 py-1.5 font-medium text-foreground text-xs transition-colors hover:bg-brand-primary-light hover:text-brand-primary lg:hidden"
							>
								<ListChecks className="size-4" />
								{t("play.lessons", { defaultValue: "Lessons" })}
							</button>
						) : null}
					</div>
				</div>
			</header>

			<div className="mx-auto max-w-6xl gap-8 px-4 py-6 lg:grid lg:grid-cols-[minmax(0,1fr)_336px]">
				<main className="min-w-0">
					{isPending || !ctx ? (
						<div className="space-y-4">
							<Skeleton className="aspect-video w-full rounded-card" />
							<Skeleton className="h-8 w-1/2 rounded" />
						</div>
					) : (
						<LessonBody key={lessonId} ctx={ctx} lessonId={lessonId} />
					)}
				</main>
				{ctx ? (
					<aside className="hidden lg:block">
						<div className="sticky top-20">
							<LessonListPanel
								lessons={ctx.lessons}
								currentId={lessonId}
								doneCount={doneCount}
								onSelect={go}
							/>
						</div>
					</aside>
				) : null}
			</div>

			{/* Mobile lesson list — native drag-to-dismiss bottom sheet. */}
			<AnimatePresence>
				{listOpen && ctx ? (
					<div className="fixed inset-0 z-50 lg:hidden">
						<motion.button
							type="button"
							aria-label={t("play.close", { defaultValue: "Close" })}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={() => setListOpen(false)}
							className="absolute inset-0 bg-slate-900/40"
						/>
						<motion.div
							initial={{ y: "100%" }}
							animate={{ y: 0 }}
							exit={{ y: "100%" }}
							transition={{ type: "spring", stiffness: 380, damping: 38 }}
							drag="y"
							dragConstraints={{ top: 0, bottom: 0 }}
							dragElastic={{ top: 0, bottom: 0.5 }}
							onDragEnd={(_, info) => {
								if (info.offset.y > 90 || info.velocity.y > 600) {
									setListOpen(false);
								}
							}}
							className="absolute inset-x-0 bottom-0 max-h-[85dvh] touch-none overflow-hidden rounded-t-card border-border border-t bg-card shadow-modal"
							style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
						>
							<div className="mx-auto my-2 h-1.5 w-10 cursor-grab rounded-full bg-slate-300 active:cursor-grabbing" />
							<LessonListPanel
								bare
								lessons={ctx.lessons}
								currentId={lessonId}
								doneCount={doneCount}
								onSelect={go}
							/>
						</motion.div>
					</div>
				) : null}
			</AnimatePresence>
		</div>
	);
}

function LessonBody({
	ctx,
	lessonId,
}: {
	ctx: LessonContext;
	lessonId: string;
}) {
	const { t } = useTranslation("authoring");
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const [done, setDone] = useState(ctx.done);
	// Captured ONCE on mount — a lesson-context refetch flips ctx.done, but the
	// next-session prompt should only greet a completion that happened NOW,
	// never a revisit of an already-finished lesson.
	const [wasIncompleteOnMount] = useState(!ctx.done);
	const [watchedPct, setWatchedPct] = useState(
		ctx.done ? 100 : Math.round(ctx.resumePct),
	);

	const maxRef = useRef(ctx.resumePct);
	const lastSentAtRef = useRef(0);
	const completionSentRef = useRef(ctx.done);

	const [quizJustPassed, setQuizJustPassed] = useState(false);

	const isReadable =
		ctx.lesson.contentType === "text" || ctx.lesson.contentType === "pdf";
	const threshold = isReadable ? 100 : Math.round(ctx.lesson.minVideoWatchPct);
	const consumptionMet = watchedPct >= threshold;
	// The post-lesson quiz only gates completion when it actually exists (§4.3).
	const postQuiz = ctx.postQuiz;
	const preQuiz = ctx.preQuiz;
	const quizDone = !postQuiz || postQuiz.passed || quizJustPassed;

	const markDone = useCallback(() => {
		setDone(true);
		queryClient.invalidateQueries({
			queryKey: ["course-progress", ctx.course.id],
		});
		queryClient.invalidateQueries({ queryKey: ["lesson-context"] });
		queryClient.invalidateQueries({ queryKey: ["my-learning"] });
		// Streak + badges react to the completion events (§3.2).
		queryClient.invalidateQueries({ queryKey: engagementKeys.me });
	}, [queryClient, ctx.course.id]);

	const report = useMutation({
		mutationFn: (body: { videoWatchedPct?: number; scrolledToEnd?: boolean }) =>
			reportLessonProgress(lessonId, body),
		onSuccess: (res) => {
			if (res.done && !done) {
				toast.success(
					t("play.done_toast", { defaultValue: "Lesson complete" }),
				);
				markDone();
			}
		},
	});

	const bodyFor = useCallback(
		(pct: number) =>
			isReadable
				? { scrolledToEnd: pct >= 100 }
				: { videoWatchedPct: Math.round(pct) },
		[isReadable],
	);

	// Consumption signal from the player → the SERVER decides completion (§4.3).
	const handleProgress = useCallback(
		(pct: number) => {
			const max = Math.max(maxRef.current, pct);
			if (max <= maxRef.current && max !== 100) return;
			maxRef.current = max;
			setWatchedPct(max);

			const reachedThreshold = max >= threshold && !completionSentRef.current;
			const throttleElapsed = Date.now() - lastSentAtRef.current > 5000;
			if (!reachedThreshold && !throttleElapsed) return;

			lastSentAtRef.current = Date.now();
			if (reachedThreshold) completionSentRef.current = true;
			report.mutate(bodyFor(max));
		},
		[threshold, report, bodyFor],
	);

	// On open: re-evaluate completion from stored progress (covers passing the
	// post-quiz elsewhere). On leave: flush the latest position so the learner
	// resumes where they stopped.
	useEffect(() => {
		reportLessonProgress(lessonId, bodyFor(maxRef.current))
			.then((res) => {
				if (res.done) markDone();
			})
			.catch(() => {});
		return () => {
			if (maxRef.current > 0) {
				reportLessonProgress(lessonId, bodyFor(maxRef.current)).catch(() => {});
			}
		};
	}, [lessonId, bodyFor, markDone]);

	const goTo = (id: string | null) => {
		if (id)
			navigate({ to: "/learn/lesson/$lessonId", params: { lessonId: id } });
		else
			navigate({
				to: "/learn/course/$courseId",
				params: { courseId: ctx.course.id },
			});
	};

	return (
		<div className="space-y-5">
			<div className="flex items-center gap-2">
				<h1 className="flex-1 font-display text-foreground text-xl sm:text-2xl">
					{ctx.lesson.title}
				</h1>
				{done ? (
					<span className="flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 font-medium text-success text-xs">
						<CheckCircle2 className="size-3.5" />
						{t("play.completed", { defaultValue: "Completed" })}
					</span>
				) : null}
			</div>

			{/* Pre-lesson recall prompt (§8.2) — optional, never gates completion. */}
			{preQuiz && !preQuiz.passed && !done ? (
				<InlineQuiz assessmentId={preQuiz.id} kind="pre" onPassed={() => {}} />
			) : null}

			<LessonPlayer
				lessonId={lessonId}
				title={ctx.lesson.title}
				onProgress={handleProgress}
				resumePct={ctx.resumePct}
			/>

			{/* System-driven completion checklist (§4.3) — no manual marking. */}
			<div
				className={cn(
					"rounded-card border p-4 shadow-card",
					done
						? "border-success/30 bg-gradient-to-br from-success/10 to-success/5"
						: "border-border bg-card",
				)}
			>
				{done ? (
					<div className="flex items-center gap-3">
						<motion.span
							initial={{ scale: 0.4, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							transition={{ type: "spring", stiffness: 260, damping: 22 }}
							className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success text-white"
						>
							<CheckCircle2 className="size-5" />
						</motion.span>
						<div>
							<p className="font-display text-foreground">
								{t("play.auto_complete_done", {
									defaultValue: "Completed — well done!",
								})}
							</p>
							<p className="text-muted-foreground text-sm">
								{ctx.nextLessonId
									? t("play.on_to_next", {
											defaultValue: "On to the next lesson.",
										})
									: t("play.course_done_hint", {
											defaultValue: "You've reached the end of the course.",
										})}
							</p>
						</div>
					</div>
				) : (
					<div className="space-y-3">
						{/* Step 1 — consume the content */}
						<div className="flex items-start gap-2.5">
							{consumptionMet ? (
								<CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
							) : (
								<Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
							)}
							<div className="min-w-0 flex-1">
								{isReadable ? (
									<p className="text-muted-foreground text-sm">
										{consumptionMet
											? t("play.read_done", { defaultValue: "Content read" })
											: t("play.read_to_complete", {
													defaultValue:
														"Scroll to the end to complete this lesson.",
												})}
									</p>
								) : (
									<>
										<div className="flex items-center justify-between gap-3 text-sm">
											<span className="text-muted-foreground">
												{t("play.completes_at", {
													defaultValue: "Completes at {{pct}}% watched",
													pct: threshold,
												})}
											</span>
											<span className="font-stats font-semibold text-foreground">
												{Math.round(watchedPct)}%
											</span>
										</div>
										<div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
											<div
												className="h-full rounded-full bg-brand-primary transition-all"
												style={{ width: `${Math.min(100, watchedPct)}%` }}
											/>
										</div>
									</>
								)}
							</div>
						</div>

						{/* Step 2 — pass the post-lesson quiz (only when one exists) */}
						{postQuiz ? (
							<div className="flex items-center gap-2.5 border-border border-t pt-3">
								{quizDone ? (
									<CheckCircle2 className="size-5 shrink-0 text-success" />
								) : (
									<ClipboardCheck className="size-5 shrink-0 text-brand-primary" />
								)}
								<p className="min-w-0 flex-1 text-muted-foreground text-sm">
									{quizDone
										? t("play.postquiz_passed", {
												defaultValue: "Post-lesson quiz passed",
											})
										: t("play.postquiz_required", {
												defaultValue: "Pass the post-lesson quiz to finish",
											})}
								</p>
							</div>
						) : null}
					</div>
				)}
			</div>

			{/* §3.2 implementation intention — asked at the moment of completion,
			    one tap, feeds the reminder engine. Fresh completions only. */}
			{done && wasIncompleteOnMount ? <NextSessionPrompt /> : null}

			{/* Inline post-lesson quiz (§8.2) — locked until the content is consumed
			    (§4.3: 80% watched / scrolled), then grades + completes in place.
			    A pass flips `done`, but the quiz stays mounted for THIS session so
			    the growth-framed result (§3.1) isn't yanked away mid-read. */}
			{postQuiz && (quizJustPassed || (!postQuiz.passed && !done)) ? (
				<InlineQuiz
					assessmentId={postQuiz.id}
					kind="post"
					locked={!consumptionMet}
					preQuizBest={preQuiz?.bestScore ?? null}
					onPassed={() => {
						setQuizJustPassed(true);
						report.mutate(bodyFor(maxRef.current));
					}}
				/>
			) : null}

			{/* Navigation — always available so finished lessons stay revisitable. */}
			<div className="flex flex-col gap-3 border-border border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
				<Button
					variant="outline"
					size="sm"
					disabled={!ctx.prevLessonId}
					onClick={() => goTo(ctx.prevLessonId)}
				>
					<ChevronLeft className="size-4" />
					{t("play.prev", { defaultValue: "Previous" })}
				</Button>
				<Button
					variant={done ? "primary" : "outline"}
					onClick={() => goTo(ctx.nextLessonId)}
				>
					{ctx.nextLessonId
						? t("play.next_lesson", { defaultValue: "Next lesson" })
						: t("play.back_to_course", { defaultValue: "Back to course" })}
					<ChevronRight className="size-4" />
				</Button>
			</div>
		</div>
	);
}
