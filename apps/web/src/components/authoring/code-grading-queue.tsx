import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardCheck, Loader2, X } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	getPendingManualAttempts,
	gradeManualAttempt,
	type PendingManualAttempt,
} from "@/lib/content-api";
import { cn } from "@/lib/utils";

const CodeWorkspace = lazy(() =>
	import("@/components/player/code-workspace").then((m) => ({
		default: m.CodeWorkspace,
	})),
);

/**
 * Instructor queue for code answers held for a manual grade (§9). Appears only
 * when an attempt is awaiting grading; each held answer is shown read-only (with
 * the creator's reference) and marked correct/incorrect. Submitting recomputes
 * the attempt's score server-side and releases the learner's result.
 */
export function CodeGradingQueue({ assessmentId }: { assessmentId: string }) {
	const { t } = useTranslation("authoring");
	const { data, isPending } = useQuery({
		queryKey: ["pending-manual", assessmentId],
		queryFn: () => getPendingManualAttempts(assessmentId),
	});

	if (isPending || !data || data.attempts.length === 0) return null;

	return (
		<section className="rounded-card border border-brand-accent/30 bg-card shadow-card">
			<header className="border-border border-b px-4 py-3 sm:px-6">
				<h2 className="flex items-center gap-2 font-display text-foreground text-lg">
					<ClipboardCheck className="size-5 text-brand-primary" />
					{t("grade.code_queue_title", {
						defaultValue: "Awaiting your grading",
					})}{" "}
					<span className="font-stats text-muted-foreground text-sm">
						({data.attempts.length})
					</span>
				</h2>
				<p className="mt-0.5 text-muted-foreground text-sm">
					{t("grade.code_queue_hint", {
						defaultValue:
							"These learners submitted code you chose to grade manually. Their result is held until you grade it.",
					})}
				</p>
			</header>
			<ul className="divide-y divide-slate-100">
				{data.attempts.map((a) => (
					<AttemptGrader
						key={a.attemptId}
						assessmentId={assessmentId}
						attempt={a}
					/>
				))}
			</ul>
		</section>
	);
}

function AttemptGrader({
	assessmentId,
	attempt,
}: {
	assessmentId: string;
	attempt: PendingManualAttempt;
}) {
	const { t } = useTranslation("authoring");
	const queryClient = useQueryClient();
	const [verdicts, setVerdicts] = useState<Record<string, boolean>>({});
	const [feedback, setFeedback] = useState("");

	const grade = useMutation({
		mutationFn: () =>
			gradeManualAttempt(attempt.attemptId, {
				verdicts: attempt.answers.map((ans) => ({
					questionId: ans.questionId,
					correct: verdicts[ans.questionId] === true,
				})),
				feedback: feedback.trim() || undefined,
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["pending-manual", assessmentId],
			});
			toast.success(t("grade.code_graded", { defaultValue: "Attempt graded" }));
		},
		onError: (e) => toast.error(e.message),
	});

	// Every held answer must get an explicit verdict before submitting.
	const allJudged = attempt.answers.every(
		(ans) => verdicts[ans.questionId] !== undefined,
	);

	return (
		<li className="p-4 sm:px-6">
			<p className="font-medium text-foreground text-sm">
				{attempt.userName ??
					attempt.userEmail ??
					t("grade.learner", { defaultValue: "Learner" })}
				<span className="ml-2 font-normal text-muted-foreground text-xs">
					{t("grade.attempt", {
						defaultValue: "Attempt {{n}}",
						n: attempt.attemptNumber,
					})}
				</span>
			</p>

			<div className="mt-3 space-y-5">
				{attempt.answers.map((ans) => (
					<div key={ans.questionId}>
						<p className="mb-2 text-foreground text-sm">{ans.body}</p>
						<Suspense
							fallback={
								<div className="flex h-[220px] items-center justify-center rounded-card border border-border bg-card">
									<Loader2 className="size-5 animate-spin text-muted-foreground" />
								</div>
							}
						>
							<CodeWorkspace
								language={ans.codeConfig?.language ?? "javascript"}
								value={ans.answer}
								readOnly
								height="220px"
							/>
						</Suspense>
						{ans.reference ? (
							<details className="mt-2 rounded-btn border border-border bg-muted/40 px-3 py-2">
								<summary className="cursor-pointer text-muted-foreground text-xs">
									{t("grade.code_reference_notes", {
										defaultValue: "Reference / grading notes",
									})}
								</summary>
								<p className="mt-1.5 whitespace-pre-wrap text-foreground text-sm">
									{ans.reference}
								</p>
							</details>
						) : null}
						<div className="mt-2 grid grid-cols-2 gap-2">
							{[
								{
									ok: true,
									label: t("grade.code_correct", { defaultValue: "Correct" }),
								},
								{
									ok: false,
									label: t("grade.code_incorrect", {
										defaultValue: "Incorrect",
									}),
								},
							].map(({ ok, label }) => (
								<button
									key={String(ok)}
									type="button"
									onClick={() =>
										setVerdicts((v) => ({ ...v, [ans.questionId]: ok }))
									}
									className={cn(
										"flex items-center justify-center gap-1.5 rounded-btn border px-3 py-2 font-medium text-sm transition-colors",
										verdicts[ans.questionId] === ok
											? ok
												? "border-success bg-success/10 text-success"
												: "border-error bg-error/10 text-error"
											: "border-border text-muted-foreground hover:border-border",
									)}
								>
									{ok ? <Check className="size-4" /> : <X className="size-4" />}
									{label}
								</button>
							))}
						</div>
					</div>
				))}
			</div>

			<label className="mt-4 block">
				<span className="mb-1.5 block font-medium text-foreground text-sm">
					{t("grade.feedback", { defaultValue: "Feedback (optional)" })}
				</span>
				<textarea
					value={feedback}
					onChange={(e) => setFeedback(e.target.value)}
					rows={2}
					className="w-full resize-none rounded-input border border-border px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-brand-primary"
				/>
			</label>

			<div className="mt-3 flex justify-end">
				<Button
					onClick={() => grade.mutate()}
					disabled={!allJudged || grade.isPending}
				>
					{grade.isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<ClipboardCheck className="size-4" />
					)}
					{t("grade.code_submit", { defaultValue: "Submit grade" })}
				</Button>
			</div>
		</li>
	);
}
