import { useMutation, useQuery } from "@tanstack/react-query";
import {
	CheckCircle2,
	ClipboardCheck,
	Loader2,
	Lock,
	RotateCcw,
	Sparkles,
	Trophy,
	XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { GrowthLine } from "@/components/engagement/growth-line";
import { ReadingLanguageToggle } from "@/components/learn/reading-language-toggle";
import { Button } from "@/components/ui/button";
import { useReadingTranslation } from "@/hooks/use-reading-translation";
import {
	type AttemptResult,
	type AttemptState,
	getAssessmentInfo,
	startAttempt,
	submitAttempt,
} from "@/lib/content-api";
import { cn } from "@/lib/utils";

/**
 * Lightweight in-lesson quiz (§8.2 retrieval practice). Reuses the server
 * attempt engine (start → submit → grade) but skips the proctored anti-cheat
 * shell — that's reserved for module/final/cohort assessments. Calls `onPassed`
 * when the learner passes so the lesson can auto-complete in place (§4.3).
 */
export function InlineQuiz({
	assessmentId,
	kind,
	onPassed,
	locked = false,
	preQuizBest = null,
}: {
	assessmentId: string;
	kind: "pre" | "post";
	onPassed: () => void;
	/** Gate starting the quiz (e.g. post-quiz until the lesson is consumed, §4.3). */
	locked?: boolean;
	/** Best pre-quiz score for this lesson — powers pre→post growth framing (§3.1). */
	preQuizBest?: number | null;
}) {
	const { t } = useTranslation("authoring");
	const [state, setState] = useState<AttemptState | null>(null);
	const [answers, setAnswers] = useState<Record<string, string>>({});
	const [result, setResult] = useState<AttemptResult | null>(null);

	const { data: info, isPending } = useQuery({
		queryKey: ["assessment-info", assessmentId],
		queryFn: () => getAssessmentInfo(assessmentId),
	});

	const start = useMutation({
		mutationFn: () => startAttempt(assessmentId),
		onSuccess: (s) => {
			setState(s);
			setAnswers(s.answers ?? {});
			setResult(null);
		},
		onError: (e) => toast.error(e.message),
	});

	const submit = useMutation({
		mutationFn: () => submitAttempt(state?.attemptId ?? "", answers),
		onSuccess: (r) => {
			setResult(r);
			setState(null);
			if (r.passed) onPassed();
		},
		onError: (e) => toast.error(e.message),
	});

	// Read-only translation (§11): all question/option/review text — grading is
	// untouched (we always submit the original option values).
	const quizTexts = useMemo(() => {
		const out: string[] = [];
		if (state)
			for (const q of state.questions) {
				out.push(q.body);
				if (q.options) out.push(...q.options);
			}
		if (result) for (const r of result.review) out.push(r.body);
		return out;
	}, [state, result]);
	const {
		lang,
		setLang,
		tr,
		loading: trLoading,
	} = useReadingTranslation(quizTexts);

	const accent =
		kind === "pre"
			? {
					Icon: Sparkles,
					tint: "text-brand-accent",
					ring: "border-brand-accent/30 bg-brand-accent-light/30",
				}
			: {
					Icon: ClipboardCheck,
					tint: "text-brand-primary",
					ring: "border-brand-primary/25 bg-brand-primary-light/30",
				};

	const title =
		kind === "pre"
			? t("play.prequiz_title", { defaultValue: "Warm-up check" })
			: t("play.postquiz_title", { defaultValue: "Post-lesson quiz" });

	return (
		<div
			className={cn(
				"overflow-hidden rounded-card border shadow-card",
				accent.ring,
			)}
		>
			<div className="flex flex-wrap items-center gap-2.5 border-border/60 border-b bg-card/60 px-4 py-3">
				<accent.Icon className={cn("size-5 shrink-0", accent.tint)} />
				<p className="flex-1 font-display text-foreground">{title}</p>
				{state || result ? (
					<ReadingLanguageToggle
						lang={lang}
						setLang={setLang}
						loading={trLoading}
					/>
				) : info ? (
					<span className="font-stats text-muted-foreground text-xs">
						{t("play.quiz_meta", {
							defaultValue: "{{n}} Q · pass {{p}}%",
							n: info.questionCount,
							p: Math.round(info.passMark),
						})}
					</span>
				) : null}
			</div>

			<div className="bg-card p-4">
				{isPending || !info ? (
					<div className="flex h-16 items-center justify-center">
						<Loader2 className="size-5 animate-spin text-muted-foreground" />
					</div>
				) : result ? (
					<QuizResult
						result={result}
						tr={tr}
						onRetry={() => start.mutate()}
						retrying={start.isPending}
						preQuizBest={kind === "post" ? preQuizBest : null}
					/>
				) : state ? (
					<ActiveQuiz
						state={state}
						tr={tr}
						answers={answers}
						setAnswers={setAnswers}
						onSubmit={() => submit.mutate()}
						submitting={submit.isPending}
					/>
				) : info.alreadyPassed ? (
					<PassedBadge score={info.bestScore} />
				) : locked ? (
					<p className="flex items-center gap-2 text-muted-foreground text-sm">
						<Lock className="size-4 shrink-0" />
						{t("play.quiz_locked", {
							defaultValue:
								"Finish the lesson content first to unlock this quiz.",
						})}
					</p>
				) : (
					<div className="flex flex-col items-start gap-3">
						<p className="text-muted-foreground text-sm">
							{kind === "pre"
								? t("play.prequiz_body", {
										defaultValue: "A quick recall quiz before you start.",
									})
								: t("play.postquiz_required", {
										defaultValue: "Pass the post-lesson quiz to finish.",
									})}
						</p>
						<Button
							size="sm"
							onClick={() => start.mutate()}
							disabled={start.isPending || info.questionCount === 0}
						>
							{start.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : null}
							{t("play.start_quiz", { defaultValue: "Start quiz" })}
						</Button>
						{info.questionCount === 0 ? (
							<p className="text-muted-foreground text-xs">
								{t("play.quiz_empty", {
									defaultValue: "No questions yet.",
								})}
							</p>
						) : null}
					</div>
				)}
			</div>
		</div>
	);
}

function PassedBadge({ score }: { score: number }) {
	const { t } = useTranslation("authoring");
	return (
		<div className="flex items-center gap-2.5 text-success">
			<Trophy className="size-5 shrink-0" />
			<p className="font-medium text-sm">
				{t("play.quiz_passed_score", {
					defaultValue: "Passed — {{s}}%",
					s: Math.round(score),
				})}
			</p>
		</div>
	);
}

function ActiveQuiz({
	state,
	tr,
	answers,
	setAnswers,
	onSubmit,
	submitting,
}: {
	state: AttemptState;
	tr: (text: string) => string;
	answers: Record<string, string>;
	setAnswers: (next: Record<string, string>) => void;
	onSubmit: () => void;
	submitting: boolean;
}) {
	const { t } = useTranslation("authoring");
	const set = (qid: string, value: string) =>
		setAnswers({ ...answers, [qid]: value });
	const answered = state.questions.filter((q) => answers[q.id]?.length).length;
	const allAnswered = answered === state.questions.length;

	return (
		<div className="space-y-4">
			{state.questions.map((q, i) => (
				<div key={q.id}>
					<div className="flex items-baseline gap-2">
						<span className="font-stats font-bold text-brand-primary text-sm">
							{i + 1}.
						</span>
						<p className="font-medium text-foreground text-sm">{tr(q.body)}</p>
					</div>
					<div className="mt-2.5 pl-5">
						{q.type === "mcq" && q.options ? (
							<div className="space-y-1.5">
								{q.options.map((opt) => (
									<Choice
										key={opt}
										label={tr(opt)}
										selected={answers[q.id] === opt}
										onClick={() => set(q.id, opt)}
									/>
								))}
							</div>
						) : q.type === "true_false" ? (
							<div className="grid grid-cols-2 gap-2">
								{["true", "false"].map((v) => (
									<Choice
										key={v}
										label={t(`play.${v}`, { defaultValue: v })}
										selected={answers[q.id] === v}
										onClick={() => set(q.id, v)}
									/>
								))}
							</div>
						) : (
							<textarea
								value={answers[q.id] ?? ""}
								onChange={(e) => set(q.id, e.target.value)}
								rows={2}
								placeholder={t("play.your_answer", {
									defaultValue: "Your answer…",
								})}
								className="w-full resize-none rounded-input border border-border px-3 py-2 text-foreground text-sm outline-none focus:border-brand-primary"
							/>
						)}
					</div>
				</div>
			))}
			<div className="flex items-center justify-between gap-3 border-border border-t pt-3">
				<span className="text-muted-foreground text-xs">
					{t("play.answered", {
						defaultValue: "{{a}}/{{n}} answered",
						a: answered,
						n: state.questions.length,
					})}
				</span>
				<Button
					size="sm"
					onClick={onSubmit}
					disabled={submitting || !allAnswered}
				>
					{submitting ? <Loader2 className="size-4 animate-spin" /> : null}
					{t("play.submit_quiz", { defaultValue: "Submit" })}
				</Button>
			</div>
		</div>
	);
}

function Choice({
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
				"flex w-full items-center gap-2.5 rounded-btn border px-3 py-2 text-left text-sm transition-colors",
				selected
					? "border-brand-primary bg-brand-primary-light text-brand-primary"
					: "border-border text-foreground hover:border-brand-primary/40 hover:bg-accent",
			)}
		>
			<span
				className={cn(
					"flex size-4 shrink-0 items-center justify-center rounded-full border",
					selected ? "border-brand-primary bg-brand-solid" : "border-border",
				)}
			>
				{selected ? <span className="size-1.5 rounded-full bg-card" /> : null}
			</span>
			{label}
		</button>
	);
}

function QuizResult({
	result,
	tr,
	onRetry,
	retrying,
	preQuizBest,
}: {
	result: AttemptResult;
	tr: (text: string) => string;
	onRetry: () => void;
	retrying: boolean;
	preQuizBest?: number | null;
}) {
	const { t } = useTranslation("authoring");
	const passed = result.passed === true;

	return (
		<div className="space-y-3">
			{/* Growth first (§3.1) — the raw score stays secondary, below. */}
			<GrowthLine
				score={Math.round(result.score)}
				previousBest={result.previousBest}
				delta={result.delta}
				preQuizBest={preQuizBest}
				className="justify-start rounded-card bg-success/10 px-3 py-2.5 text-sm"
			/>
			<div
				className={cn(
					"flex items-center gap-3 rounded-card p-3",
					passed ? "bg-success/10 text-success" : "bg-error/5 text-error",
				)}
			>
				{passed ? (
					<Trophy className="size-6 shrink-0" />
				) : (
					<XCircle className="size-6 shrink-0" />
				)}
				<div className="min-w-0 flex-1">
					<p className="font-display text-base">
						{passed
							? t("play.quiz_pass", { defaultValue: "Passed!" })
							: t("play.quiz_fail", { defaultValue: "Not passed yet" })}
					</p>
					<p className="text-sm opacity-80">
						{t("play.quiz_score", {
							defaultValue: "Score {{s}}% · pass {{p}}%",
							s: Math.round(result.score),
							p: Math.round(result.passMark),
						})}
					</p>
				</div>
			</div>

			<ul className="space-y-1.5">
				{result.review.map((r, i) => (
					<li key={r.id} className="flex items-start gap-2 text-sm">
						{r.correct ? (
							<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
						) : (
							<XCircle className="mt-0.5 size-4 shrink-0 text-error" />
						)}
						<span className="min-w-0 flex-1 text-muted-foreground">
							<span className="font-medium text-foreground">{i + 1}.</span>{" "}
							{tr(r.body)}
						</span>
					</li>
				))}
			</ul>

			{!passed ? (
				<Button
					size="sm"
					variant="outline"
					onClick={onRetry}
					disabled={retrying}
				>
					{retrying ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<RotateCcw className="size-4" />
					)}
					{t("play.retry_quiz", { defaultValue: "Try again" })}
				</Button>
			) : null}
		</div>
	);
}
