import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2,
	ExternalLink,
	FileText,
	Loader2,
	Paperclip,
	Sparkles,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	aiDraftGrade,
	getSubmissionForGrading,
	gradeSubmission,
} from "@/lib/content-api";
import { cn } from "@/lib/utils";

export function GradeSubmissionDialog({
	submissionId,
	onClose,
	onGraded,
}: {
	submissionId: string;
	onClose: () => void;
	onGraded?: () => void;
}) {
	const { t } = useTranslation("authoring");
	const queryClient = useQueryClient();
	const [scores, setScores] = useState<Record<string, number>>({});
	const [comments, setComments] = useState<Record<string, string>>({});
	const [feedback, setFeedback] = useState("");
	const [seeded, setSeeded] = useState(false);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	const {
		data: sub,
		isPending,
		isError,
		error,
	} = useQuery({
		queryKey: ["grade-submission", submissionId],
		queryFn: () => getSubmissionForGrading(submissionId),
	});

	// Seed from any existing grade once loaded.
	if (sub && !seeded) {
		const seed: Record<string, number> = {};
		for (const s of sub.rubricScores ?? []) seed[s.criterionId] = s.points;
		setScores(seed);
		setFeedback(sub.feedback ?? "");
		setSeeded(true);
	}

	const draft = useMutation({
		mutationFn: () => aiDraftGrade(submissionId),
		onSuccess: (res) => {
			const nextScores: Record<string, number> = {};
			const nextComments: Record<string, string> = {};
			for (const s of res.scores) {
				nextScores[s.criterionId] = s.points;
				nextComments[s.criterionId] = s.comment;
			}
			setScores(nextScores);
			setComments(nextComments);
			if (res.feedback) setFeedback(res.feedback);
			toast.success(
				t("grade.drafted", { defaultValue: "AI draft ready — review it" }),
			);
		},
		onError: (e) => toast.error(e.message),
	});

	const save = useMutation({
		mutationFn: () =>
			gradeSubmission(submissionId, {
				rubricScores: sub?.rubric.length
					? sub.rubric.map((c) => ({
							criterionId: c.id ?? "",
							points: scores[c.id ?? ""] ?? 0,
						}))
					: undefined,
				score: sub?.rubric.length ? undefined : scores.__manual,
				feedback: feedback.trim() || undefined,
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["grade-submission", submissionId],
			});
			toast.success(t("grade.saved", { defaultValue: "Grade saved" }));
			onGraded?.();
			onClose();
		},
		onError: (e) => toast.error(e.message),
	});

	const rubric = sub?.rubric ?? [];
	const totalMax = rubric.reduce((s, c) => s + c.maxPoints, 0);
	const earned = rubric.reduce((s, c) => s + (scores[c.id ?? ""] ?? 0), 0);
	const pct =
		totalMax > 0 ? Math.round((earned / totalMax) * 10000) / 100 : null;
	const passes = pct != null && sub ? pct >= sub.passMark : false;

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4">
			<div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-card bg-card shadow-2xl sm:rounded-card">
				<header className="flex items-center justify-between border-border border-b px-5 py-3.5">
					<h3 className="font-display text-lg text-foreground">
						{t("grade.title", { defaultValue: "Grade submission" })}
					</h3>
					<button
						type="button"
						aria-label="Close"
						onClick={onClose}
						className="flex size-8 items-center justify-center rounded-btn text-muted-foreground hover:bg-accent"
					>
						<X className="size-4" />
					</button>
				</header>

				<div className="overflow-y-auto p-5">
					{isPending ? (
						<div className="flex h-40 items-center justify-center">
							<Loader2 className="size-6 animate-spin text-brand-primary" />
						</div>
					) : isError || !sub ? (
						<div className="rounded-card border border-error/30 bg-error/5 p-4 text-error">
							<p className="font-semibold">
								{t("grade.load_failed", {
									defaultValue: "Submission could not be loaded",
								})}
							</p>
							<p className="mt-1 text-sm">
								{error instanceof Error
									? error.message
									: t("grade.load_failed_body", {
											defaultValue:
												"Refresh the page or go back and try again.",
										})}
							</p>
						</div>
					) : (
						<div className="space-y-5">
							<div>
								<p className="font-medium text-foreground">
									{sub.userName ||
										sub.userEmail ||
										t("grade.learner", { defaultValue: "Learner" })}
								</p>
								<p className="text-muted-foreground text-xs">
									{t("grade.attempt", {
										defaultValue: "Attempt {{n}}",
										n: sub.attemptNumber,
									})}
									{sub.submittedAt
										? ` · ${new Date(sub.submittedAt).toLocaleString()}`
										: ""}
								</p>
							</div>

							{/* Submission content */}
							{sub.textContent ? (
								<div className="rounded-card border border-border p-3">
									<p className="mb-1 flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase">
										<FileText className="size-3.5" />
										{t("grade.writeup", { defaultValue: "Write-up" })}
									</p>
									<p className="whitespace-pre-wrap text-foreground text-sm">
										{sub.textContent}
									</p>
								</div>
							) : null}
							{sub.urlSubmission ? (
								<a
									href={sub.urlSubmission}
									target="_blank"
									rel="noreferrer"
									className="flex items-center gap-2 rounded-card border border-border p-3 text-brand-primary text-sm hover:bg-accent"
								>
									<ExternalLink className="size-4 shrink-0" />
									<span className="truncate">{sub.urlSubmission}</span>
								</a>
							) : null}
							{sub.files.map((f) => (
								<a
									key={f.url}
									href={f.url}
									target="_blank"
									rel="noreferrer"
									className="flex items-center gap-2 rounded-card border border-border p-3 text-sm text-foreground hover:bg-accent"
								>
									<Paperclip className="size-4 shrink-0 text-muted-foreground" />
									<span className="truncate">{f.name}</span>
								</a>
							))}

							{/* AI draft */}
							{sub.gradingType === "ai_assisted" ? (
								<Button
									variant="outline"
									className="w-full"
									onClick={() => draft.mutate()}
									disabled={draft.isPending}
								>
									{draft.isPending ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<Sparkles className="size-4" />
									)}
									{t("grade.ai_draft", { defaultValue: "Draft grade with AI" })}
								</Button>
							) : null}

							{/* Rubric scoring */}
							{rubric.length > 0 ? (
								<div className="space-y-3">
									{rubric.map((c) => {
										const id = c.id ?? "";
										return (
											<div
												key={id}
												className="rounded-card border border-border p-3"
											>
												<div className="flex items-center justify-between gap-3">
													<span className="font-medium text-foreground text-sm">
														{c.label}
													</span>
													<div className="flex items-center gap-1 text-sm">
														<input
															type="number"
															min={0}
															max={c.maxPoints}
															value={scores[id] ?? 0}
															onChange={(e) =>
																setScores((p) => ({
																	...p,
																	[id]: Math.max(
																		0,
																		Math.min(
																			c.maxPoints,
																			Number(e.target.value),
																		),
																	),
																}))
															}
															className="h-9 w-16 rounded-input border border-border px-2 text-right outline-none focus:border-brand-primary"
														/>
														<span className="text-muted-foreground">
															/ {c.maxPoints}
														</span>
													</div>
												</div>
												{comments[id] ? (
													<p className="mt-1.5 flex items-start gap-1.5 text-muted-foreground text-xs">
														<Sparkles className="mt-0.5 size-3 shrink-0 text-brand-primary" />
														{comments[id]}
													</p>
												) : null}
											</div>
										);
									})}
									<div
										className={cn(
											"flex items-center justify-between rounded-card border p-3 font-medium text-sm",
											passes
												? "border-success/30 bg-success/5 text-success"
												: "border-border text-foreground",
										)}
									>
										<span>{t("grade.score", { defaultValue: "Score" })}</span>
										<span className="font-stats font-bold">
											{earned}/{totalMax} · {pct}% ·{" "}
											{passes
												? t("grade.pass", { defaultValue: "Pass" })
												: t("grade.fail", { defaultValue: "Fail" })}
										</span>
									</div>
								</div>
							) : (
								<label className="block">
									<span className="mb-1.5 block font-medium text-foreground text-sm">
										{t("grade.manual_score", { defaultValue: "Score %" })}
									</span>
									<input
										type="number"
										min={0}
										max={100}
										value={scores.__manual ?? 0}
										onChange={(e) =>
											setScores((p) => ({
												...p,
												__manual: Number(e.target.value),
											}))
										}
										className="h-11 w-32 rounded-input border border-border px-3 outline-none focus:border-brand-primary"
									/>
								</label>
							)}

							<label className="block">
								<span className="mb-1.5 block font-medium text-foreground text-sm">
									{t("grade.feedback", { defaultValue: "Feedback" })}
								</span>
								<textarea
									value={feedback}
									onChange={(e) => setFeedback(e.target.value)}
									rows={3}
									className="w-full resize-none rounded-input border border-border px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-brand-primary"
								/>
							</label>
						</div>
					)}
				</div>

				{sub ? (
					<div className="flex justify-end gap-2 border-border border-t p-4">
						<Button variant="ghost" onClick={onClose}>
							{t("grade.cancel", { defaultValue: "Cancel" })}
						</Button>
						<Button onClick={() => save.mutate()} disabled={save.isPending}>
							{save.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<CheckCircle2 className="size-4" />
							)}
							{t("grade.submit", { defaultValue: "Save grade" })}
						</Button>
					</div>
				) : null}
			</div>
		</div>
	);
}
