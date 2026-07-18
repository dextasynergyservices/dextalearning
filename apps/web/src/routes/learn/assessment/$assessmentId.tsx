import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	Clock,
	Loader2,
	RotateCcw,
	ShieldCheck,
	Sparkles,
	Timer,
	WifiOff,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { RequireAuth } from "@/components/auth/require-auth";
import { CameraMonitor } from "@/components/learn/camera-monitor";
import { ReadingLanguageToggle } from "@/components/learn/reading-language-toggle";
import { Button } from "@/components/ui/button";
import { useAntiCheat } from "@/hooks/use-anti-cheat";
import {
	clearLocalAnswers,
	loadLocalAnswers,
	useAttemptResilience,
} from "@/hooks/use-attempt-resilience";
import { useOnline } from "@/hooks/use-online";
import { useReadingTranslation } from "@/hooks/use-reading-translation";
import { ApiError } from "@/lib/api";
import {
	type AttemptInfo,
	type AttemptResult,
	type AttemptState,
	getAssessmentInfo,
	getAttempt,
	getAttemptResult,
	startAttempt,
	submitAttempt,
} from "@/lib/content-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/learn/assessment/$assessmentId")({
	component: TakeAssessmentRoute,
});

function TakeAssessmentRoute() {
	const { assessmentId } = Route.useParams();
	return (
		<RequireAuth>
			<AssessmentRunner assessmentId={assessmentId} />
		</RequireAuth>
	);
}

function AssessmentRunner({ assessmentId }: { assessmentId: string }) {
	const [attempt, setAttempt] = useState<AttemptState | null>(null);
	const [result, setResult] = useState<AttemptResult | null>(null);
	const streamRef = useRef<MediaStream | null>(null);

	const stopStream = useCallback(() => {
		for (const track of streamRef.current?.getTracks() ?? []) track.stop();
		streamRef.current = null;
	}, []);
	// Always release the camera when leaving the page.
	useEffect(() => stopStream, [stopStream]);

	const showIntro = !attempt && !result;
	const { data: info, isPending } = useQuery({
		queryKey: ["assessment-info", assessmentId],
		queryFn: () => getAssessmentInfo(assessmentId),
		enabled: showIntro,
	});

	if (result) {
		return (
			<ResultView
				result={result}
				onRetake={() => {
					setResult(null);
					setAttempt(null);
				}}
			/>
		);
	}
	if (attempt) {
		return (
			<TakingView
				attempt={attempt}
				stream={streamRef.current}
				onFinished={(r) => {
					stopStream();
					setResult(r);
					setAttempt(null);
				}}
			/>
		);
	}
	if (isPending || !info) {
		return (
			<Shell>
				<div className="flex h-64 items-center justify-center">
					<Loader2 className="size-7 animate-spin text-brand-primary" />
				</div>
			</Shell>
		);
	}
	return (
		<IntroView
			info={info}
			onStream={(s) => {
				streamRef.current = s;
			}}
			onStarted={(s) => setAttempt(s)}
			onShowResult={(r) => setResult(r)}
		/>
	);
}

// ── Focused exam shell ───────────────────────────────────────────────────────
function Shell({
	children,
	bar,
}: {
	children: React.ReactNode;
	bar?: React.ReactNode;
}) {
	const navigate = useNavigate();
	return (
		<div className="min-h-dvh bg-muted">
			<header className="sticky top-0 z-10 border-border border-b bg-card/90 backdrop-blur">
				<div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-4">
					<button
						type="button"
						onClick={() => navigate({ to: "/dashboard" })}
						className="flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
					>
						<ArrowLeft className="size-4" />
						<span className="hidden sm:inline">Exit</span>
					</button>
					{bar}
				</div>
			</header>
			<main className="mx-auto max-w-2xl px-4 py-6 pb-28">{children}</main>
		</div>
	);
}

// ── Intro / start screen ─────────────────────────────────────────────────────
const REASON_KEY: Record<string, string> = {
	no_questions: "take.reason_no_questions",
	already_passed: "take.reason_passed",
	no_retakes_left: "take.reason_no_retakes",
	cooldown: "take.reason_cooldown",
	// Retakes used up, but the allowance resets once the lockout elapses (§4.4).
	locked_out: "take.reason_locked_out",
	// The final is still gated behind unfinished lessons/quizzes (§4.3).
	prerequisites: "take.reason_prerequisites",
};

function IntroView({
	info,
	onStream,
	onStarted,
	onShowResult,
}: {
	info: AttemptInfo;
	onStream: (s: MediaStream) => void;
	onStarted: (s: AttemptState) => void;
	onShowResult: (r: AttemptResult) => void;
}) {
	const { t } = useTranslation("authoring");

	// Camera is required before the attempt can begin (§4.6.2).
	const ensureCamera = async () => {
		if (!info.anticheat.cameraRequired) return;
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { width: 640, height: 480 },
				audio: false,
			});
			onStream(stream);
		} catch {
			throw new Error(
				t("take.camera_denied", {
					defaultValue: "Camera access is required to start this assessment.",
				}),
			);
		}
	};

	const start = useMutation({
		mutationFn: async () => {
			await ensureCamera();
			return startAttempt(info.id);
		},
		onSuccess: onStarted,
		onError: (e) =>
			toast.error(
				e instanceof ApiError || e instanceof Error
					? e.message
					: t("take.start_failed", { defaultValue: "Could not start" }),
			),
	});

	const resume = useMutation({
		mutationFn: async () => {
			const id = info.inProgressAttemptId;
			if (!id) throw new Error("no attempt");
			await ensureCamera();
			return getAttempt(id);
		},
		onSuccess: (snap) => {
			if (snap.status === "in_progress") onStarted(snap.state);
			else onShowResult(snap.result);
		},
		onError: (e) => toast.error(e.message),
	});

	const viewResult = useMutation({
		mutationFn: () => getAttemptResult(info.lastAttemptId ?? ""),
		onSuccess: onShowResult,
		onError: (e) => toast.error(e.message),
	});

	const blockedMsg = info.reason ? REASON_KEY[info.reason] : undefined;

	return (
		<Shell>
			<div className="rounded-card border border-border bg-card p-6 shadow-card sm:p-8">
				<p className="font-stats font-semibold text-brand-primary text-xs uppercase">
					{t(`assessment.scope_${info.scope}`, { defaultValue: "Assessment" })}
				</p>
				<h1 className="mt-2 font-display text-2xl text-foreground sm:text-3xl">
					{info.title ||
						t("assessment.untitled", { defaultValue: "Assessment" })}
				</h1>

				<dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
					<Fact
						icon={Sparkles}
						label={t("take.questions", { defaultValue: "Questions" })}
						value={String(info.questionCount)}
					/>
					<Fact
						icon={CheckCircle2}
						label={t("take.pass_mark", { defaultValue: "Pass mark" })}
						value={`${info.passMark}%`}
					/>
					<Fact
						icon={Clock}
						label={t("take.time", { defaultValue: "Time" })}
						value={
							info.timeLimitMinutes
								? t("take.minutes", {
										defaultValue: "{{n}} min",
										n: info.timeLimitMinutes,
									})
								: t("take.untimed", { defaultValue: "Untimed" })
						}
					/>
					<Fact
						icon={RotateCcw}
						label={t("take.retakes", { defaultValue: "Retakes left" })}
						value={
							info.retakesRemaining == null
								? t("take.unlimited", { defaultValue: "Unlimited" })
								: String(info.retakesRemaining)
						}
					/>
					{info.attemptsUsed > 0 ? (
						<Fact
							icon={CheckCircle2}
							label={t("take.best", { defaultValue: "Best score" })}
							value={`${info.bestScore}%`}
						/>
					) : null}
				</dl>

				{/* Integrity notice */}
				<div className="mt-5 flex items-start gap-2.5 rounded-card border border-brand-primary/15 bg-brand-primary/5 p-3.5 text-muted-foreground text-sm">
					<ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-primary" />
					<p>
						{t("take.integrity_notice", {
							defaultValue:
								"This is a monitored assessment. The timer runs on the server and your answers are graded automatically.",
						})}
						{info.anticheat.cameraRequired
							? ` ${t("take.camera_notice", { defaultValue: "Camera monitoring is required." })}`
							: ""}
					</p>
				</div>

				{blockedMsg ? (
					<div className="mt-5 flex items-start gap-2.5 rounded-card border border-warning/30 bg-warning/10 p-3.5 text-amber-800 dark:text-amber-200 text-sm">
						<AlertTriangle className="mt-0.5 size-4 shrink-0" />
						<div>
							<p className="font-medium">
								{t(blockedMsg, { defaultValue: "You can't start right now." })}
							</p>
							{info.reason === "cooldown" && info.cooldownUntil ? (
								<p className="mt-0.5 text-xs">
									{t("take.cooldown_until", {
										defaultValue: "Available {{when}}",
										when: new Date(info.cooldownUntil).toLocaleString(),
									})}
								</p>
							) : null}
							{info.reason === "locked_out" && info.lockedUntil ? (
								<p className="mt-0.5 text-xs">
									{t("take.locked_until", {
										defaultValue: "Your retakes reset {{when}}",
										when: new Date(info.lockedUntil).toLocaleString(),
									})}
								</p>
							) : null}
						</div>
					</div>
				) : null}

				<div className="mt-6 flex flex-col gap-2 sm:flex-row">
					{info.inProgressAttemptId ? (
						<Button
							size="lg"
							className="flex-1"
							onClick={() => resume.mutate()}
							disabled={resume.isPending}
						>
							{resume.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Timer className="size-4" />
							)}
							{t("take.resume", { defaultValue: "Resume attempt" })}
						</Button>
					) : info.canStart ? (
						<Button
							size="lg"
							className="flex-1"
							onClick={() => start.mutate()}
							disabled={start.isPending}
						>
							{start.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : null}
							{info.anticheat.cameraRequired
								? t("take.camera_start", {
										defaultValue: "Enable camera & start",
									})
								: t("take.start", { defaultValue: "Start assessment" })}
						</Button>
					) : null}

					{info.lastAttemptId ? (
						<Button
							size="lg"
							variant="outline"
							className="flex-1"
							onClick={() => viewResult.mutate()}
							disabled={viewResult.isPending}
						>
							{viewResult.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : null}
							{t("take.view_result", { defaultValue: "View last result" })}
						</Button>
					) : null}
				</div>
			</div>
		</Shell>
	);
}

function Fact({
	icon: Icon,
	label,
	value,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string;
}) {
	return (
		<div className="rounded-btn border border-border bg-muted p-3">
			<Icon className="size-4 text-brand-primary" />
			<p className="mt-1.5 font-stats font-bold text-lg text-foreground">
				{value}
			</p>
			<p className="text-muted-foreground text-xs leading-tight">{label}</p>
		</div>
	);
}

// ── Taking view ──────────────────────────────────────────────────────────────
function fmt(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}

function TakingView({
	attempt,
	stream,
	onFinished,
}: {
	attempt: AttemptState;
	stream: MediaStream | null;
	onFinished: (r: AttemptResult) => void;
}) {
	const { t } = useTranslation("authoring");
	const [answers, setAnswers] = useState<Record<string, string>>(() => ({
		// Server first, local mirror on top: the mirror includes answers whose
		// saves were lost to an outage, so after a crash+resume the learner
		// gets back exactly what they had chosen (§ D4 resilience).
		...(attempt.answers ?? {}),
		...loadLocalAnswers(attempt.attemptId),
	}));
	const [remaining, setRemaining] = useState<number | null>(
		attempt.remainingSeconds,
	);
	const submittedRef = useRef(false);
	const online = useOnline();
	const { persistAnswer, flushPending } = useAttemptResilience(
		attempt.attemptId,
	);

	const submit = useMutation({
		mutationFn: () => submitAttempt(attempt.attemptId, answers),
		onSuccess: (r) => {
			clearLocalAnswers(attempt.attemptId);
			onFinished(r);
		},
		onError: (e) => {
			// Server auto-submitted on expiry — surface the result if present.
			if (e instanceof ApiError && e.code === "TIME_UP") {
				const res = (e.details as { result?: AttemptResult } | undefined)
					?.result;
				if (res) {
					clearLocalAnswers(attempt.attemptId);
					return onFinished(res);
				}
			}
			// A failed submit is NOT a submitted attempt: reopen the guard so the
			// learner (or the reconnect listener below) can try again. Before this,
			// an offline submit left submittedRef=true and a permanently dead
			// button — the attempt looked lost when nothing was lost at all.
			submittedRef.current = false;
			if (e instanceof ApiError) {
				toast.error(e.message);
			} else {
				toast.error(
					t("take.offline_submit", {
						defaultValue:
							"You seem to be offline. Your answers are safe on this device — we'll submit as soon as you're back.",
					}),
				);
			}
		},
	});

	const doSubmit = useCallback(() => {
		if (submittedRef.current) return;
		submittedRef.current = true;
		wantsSubmitRef.current = true;
		submit.mutate();
	}, [submit]);

	// Reconnect: finish what the outage interrupted — flush queued answer
	// saves, and re-fire a submit the learner already asked for.
	const wantsSubmitRef = useRef(false);
	useEffect(() => {
		const onOnline = () => {
			void flushPending();
			if (wantsSubmitRef.current && !submittedRef.current) doSubmit();
		};
		window.addEventListener("online", onOnline);
		return () => window.removeEventListener("online", onOnline);
	}, [doSubmit, flushPending]);

	// Server-authoritative countdown; auto-submit at zero.
	useEffect(() => {
		if (remaining == null) return;
		if (remaining <= 0) {
			doSubmit();
			return;
		}
		const id = setInterval(() => {
			setRemaining((prev) => (prev == null ? null : Math.max(0, prev - 1)));
		}, 1000);
		return () => clearInterval(id);
	}, [remaining, doSubmit]);

	// Client-side anti-cheat: detect/log/block + auto-submit on threshold (§4.6.1).
	useAntiCheat({
		attemptId: attempt.attemptId,
		enabled: true,
		copyPasteBlocked: attempt.anticheat.copyPasteBlocked,
		fullscreenRequired: attempt.anticheat.fullscreenRequired,
		tabSwitchLimit: attempt.anticheat.tabSwitchLimit,
		onAutoSubmit: doSubmit,
		onTabSwitch: (count, limit) => {
			if (count < limit) {
				toast.warning(
					t("take.tab_warning", {
						defaultValue: "Leaving the page is logged ({{count}}/{{limit}}).",
						count,
						limit,
					}),
				);
			} else {
				toast.error(
					t("take.tab_autosubmit", {
						defaultValue: "Too many tab switches — submitting your attempt.",
					}),
				);
			}
		},
	});

	const setAnswer = (questionId: string, value: string) => {
		setAnswers((prev) => {
			const next = { ...prev, [questionId]: value };
			// Mirror locally + save with an offline queue: an outage can no
			// longer eat an answer (§ D4 resilience).
			persistAnswer(next, questionId, value);
			return next;
		});
	};

	const answeredCount = attempt.questions.filter(
		(q) => answers[q.id]?.length,
	).length;
	const lowTime = remaining != null && remaining <= 30;

	// Read-only translation (§11): translate question/option display text only —
	// answers submitted stay the canonical option values, so grading is unchanged.
	const quizTexts = useMemo(() => {
		const out: string[] = [];
		for (const q of attempt.questions) {
			out.push(q.body);
			if (q.options) out.push(...q.options);
		}
		return out;
	}, [attempt.questions]);
	const {
		lang,
		setLang,
		tr,
		loading: trLoading,
	} = useReadingTranslation(quizTexts);

	return (
		<Shell
			bar={
				<div className="flex items-center gap-3">
					<ReadingLanguageToggle
						lang={lang}
						setLang={setLang}
						loading={trLoading}
					/>
					<span className="text-muted-foreground text-sm">
						{answeredCount}/{attempt.questions.length}
					</span>
					{remaining != null ? (
						<span
							className={cn(
								"flex items-center gap-1.5 rounded-full px-2.5 py-1 font-stats font-bold text-sm tabular-nums",
								lowTime
									? "animate-pulse bg-error/10 text-error"
									: "bg-brand-primary/10 text-brand-primary",
							)}
						>
							<Timer className="size-4" />
							{fmt(remaining)}
						</span>
					) : null}
				</div>
			}
		>
			{stream && attempt.anticheat.cameraRequired ? (
				<CameraMonitor stream={stream} attemptId={attempt.attemptId} />
			) : null}
			{/* A dropped connection never closes or fails the attempt — but the
			    clock keeps running (§4.6.3): pausing it would make airplane mode
			    the cheapest cheat. Say both truths out loud. */}
			{!online ? (
				<div
					role="status"
					className="mb-4 flex items-start gap-2.5 rounded-card border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"
				>
					<WifiOff className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
					<p className="text-foreground">
						{t("take.offline_banner", {
							defaultValue:
								"You're offline — keep going. Your answers are saved on this device and will sync when you're back. The timer keeps running.",
						})}
					</p>
				</div>
			) : null}
			<div className="space-y-4">
				{attempt.questions.map((q, index) => (
					<div
						key={q.id}
						className="rounded-card border border-border bg-card p-4 shadow-card sm:p-5"
					>
						<div className="flex items-baseline gap-2">
							<span className="font-stats font-bold text-brand-primary text-sm">
								{index + 1}.
							</span>
							<p className="font-medium text-foreground">{tr(q.body)}</p>
						</div>

						<div className="mt-3.5">
							{q.type === "mcq" && q.options ? (
								<div className="space-y-2">
									{q.options.map((opt) => (
										<OptionButton
											key={opt}
											label={tr(opt)}
											selected={answers[q.id] === opt}
											onClick={() => setAnswer(q.id, opt)}
										/>
									))}
								</div>
							) : q.type === "true_false" ? (
								<div className="grid grid-cols-2 gap-2">
									{["true", "false"].map((v) => (
										<OptionButton
											key={v}
											label={t(`assessment.${v}`, { defaultValue: v })}
											selected={answers[q.id] === v}
											onClick={() => setAnswer(q.id, v)}
										/>
									))}
								</div>
							) : (
								<textarea
									value={answers[q.id] ?? ""}
									onChange={(e) => setAnswer(q.id, e.target.value)}
									rows={3}
									placeholder={t("take.your_answer", {
										defaultValue: "Your answer…",
									})}
									className="w-full resize-none rounded-input border border-border px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-brand-primary"
								/>
							)}
						</div>
					</div>
				))}
			</div>

			<div className="fixed inset-x-0 bottom-0 border-border border-t bg-card/95 backdrop-blur">
				<div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
					<span className="text-muted-foreground text-sm">
						{t("take.answered", {
							defaultValue: "{{a}} of {{n}} answered",
							a: answeredCount,
							n: attempt.questions.length,
						})}
					</span>
					<Button onClick={doSubmit} disabled={submit.isPending}>
						{submit.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : null}
						{t("take.submit", { defaultValue: "Submit" })}
					</Button>
				</div>
			</div>
		</Shell>
	);
}

function OptionButton({
	label,
	selected,
	onClick,
}: {
	label: string;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex w-full items-center gap-3 rounded-btn border px-3.5 py-3 text-left text-sm transition-colors",
				selected
					? "border-brand-primary bg-brand-primary/10 font-medium text-brand-primary"
					: "border-border text-foreground hover:border-border hover:bg-accent",
			)}
		>
			<span
				className={cn(
					"size-4 shrink-0 rounded-full border-2",
					selected ? "border-brand-primary bg-brand-solid" : "border-border",
				)}
			/>
			<span className="break-words">{label}</span>
		</button>
	);
}

// ── Result view ──────────────────────────────────────────────────────────────
function ResultView({
	result,
	onRetake,
}: {
	result: AttemptResult;
	onRetake: () => void;
}) {
	const { t } = useTranslation("authoring");
	const passed = result.passed === true;

	return (
		<Shell>
			<div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
				<div
					className={cn(
						"p-6 text-center sm:p-8",
						passed ? "bg-success/5" : "bg-error/5",
					)}
				>
					{passed ? (
						<CheckCircle2 className="mx-auto size-12 text-success" />
					) : (
						<XCircle className="mx-auto size-12 text-error" />
					)}
					<h1 className="mt-3 font-display text-2xl text-foreground">
						{passed
							? t("take.passed", { defaultValue: "Passed" })
							: t("take.failed", { defaultValue: "Not passed" })}
					</h1>
					<p className="mt-1 font-stats font-bold text-4xl text-foreground">
						{result.score}%
					</p>
					<p className="mt-1 text-muted-foreground text-sm">
						{t("take.pass_was", {
							defaultValue: "Pass mark was {{mark}}%",
							mark: result.passMark,
						})}
						{result.autoSubmitted
							? ` · ${t("take.auto_submitted", { defaultValue: "auto-submitted (time up)" })}`
							: ""}
					</p>
					{result.flagCount > 0 ? (
						<p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-amber-800 dark:text-amber-200 text-xs">
							<ShieldCheck className="size-3.5" />
							{t("take.integrity", {
								defaultValue: "Integrity score {{score}}/100",
								score: result.integrityScore,
							})}
						</p>
					) : null}
				</div>

				<div className="divide-y divide-slate-100">
					{result.review.map((item, index) => (
						<div key={item.id} className="p-4 sm:px-5">
							<div className="flex items-start gap-2">
								{item.correct ? (
									<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
								) : (
									<XCircle className="mt-0.5 size-4 shrink-0 text-error" />
								)}
								<p className="font-medium text-foreground text-sm">
									{index + 1}. {item.body}
								</p>
							</div>
							<div className="mt-2 space-y-1 pl-6 text-sm">
								<p
									className={cn(
										item.correct ? "text-success" : "text-muted-foreground",
									)}
								>
									<span className="text-muted-foreground">
										{t("take.your_answer_label", {
											defaultValue: "Your answer",
										})}
										:{" "}
									</span>
									{item.yourAnswer || t("take.blank", { defaultValue: "—" })}
								</p>
								{!item.correct ? (
									<p className="text-success">
										<span className="text-muted-foreground">
											{t("assessment.correct_answer", {
												defaultValue: "Correct answer",
											})}
											:{" "}
										</span>
										{item.correctAnswer || "—"}
									</p>
								) : null}
							</div>
						</div>
					))}
				</div>
			</div>

			<div className="mt-5">
				<Button variant="outline" className="w-full" onClick={onRetake}>
					<RotateCcw className="size-4" />
					{t("take.back", { defaultValue: "Back to overview" })}
				</Button>
			</div>
		</Shell>
	);
}
