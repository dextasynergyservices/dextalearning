import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowDown,
	ArrowUp,
	Check,
	CircleHelp,
	Loader2,
	Pencil,
	Plus,
	ShieldCheck,
	Sparkles,
	Trash2,
	X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AssessmentSettingsPanel } from "@/components/authoring/assessment-settings-panel";
import { StudioShell } from "@/components/authoring/studio-shell";
import { ReadingLanguageToggle } from "@/components/learn/reading-language-toggle";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useReadingTranslation } from "@/hooks/use-reading-translation";
import {
	type AssessmentDetail,
	addQuestion,
	deleteAssessment,
	deleteQuestion,
	generateQuestions,
	getAssessment,
	type QuestionInput,
	type QuestionNode,
	type QuestionType,
	reorderQuestions,
	updateQuestion,
} from "@/lib/content-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/instructor/assessments/$assessmentId")({
	component: InstructorAssessmentRoute,
});

function InstructorAssessmentRoute() {
	const { assessmentId } = Route.useParams();
	return <AssessmentEditorPage assessmentId={assessmentId} area="instructor" />;
}

const QUESTION_TYPES: QuestionType[] = ["mcq", "true_false", "short_answer"];

export function AssessmentEditorPage({
	assessmentId,
	area = "instructor",
}: {
	assessmentId: string;
	area?: "instructor" | "admin";
}) {
	const { t } = useTranslation("authoring");
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [editing, setEditing] = useState<QuestionNode | "new" | null>(null);
	const [aiOpen, setAiOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);

	const { data: assessment, isPending } = useQuery({
		queryKey: ["assessment", assessmentId],
		queryFn: () => getAssessment(assessmentId),
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["assessment", assessmentId] });

	const removeAssessment = useMutation({
		mutationFn: () => deleteAssessment(assessmentId),
		onSuccess: () => {
			toast.success(
				t("assessment.deleted", { defaultValue: "Assessment deleted" }),
			);
			navigate({
				to: area === "admin" ? "/admin/courses" : "/instructor/courses",
			});
		},
		onError: (e) => toast.error(e.message),
	});

	const removeQuestion = useMutation({
		mutationFn: (id: string) => deleteQuestion(id),
		onSuccess: invalidate,
		onError: (e) => toast.error(e.message),
	});

	const reorder = useMutation({
		mutationFn: (ids: string[]) => reorderQuestions(assessmentId, ids),
		onSuccess: invalidate,
		onError: (e) => toast.error(e.message),
	});

	const questions = assessment?.questions ?? [];

	// Author-side preview of how questions read in another language (§11).
	const previewTexts = useMemo(() => {
		const out: string[] = [];
		for (const q of questions) {
			out.push(q.body);
			if (Array.isArray(q.optionsJson)) {
				out.push(...(q.optionsJson as string[]));
			}
		}
		return out;
	}, [questions]);
	const {
		lang,
		setLang,
		tr,
		loading: trLoading,
	} = useReadingTranslation(previewTexts);

	const move = (index: number, dir: -1 | 1) => {
		const ids = questions.map((q) => q.id);
		const target = index + dir;
		if (target < 0 || target >= ids.length) return;
		[ids[index], ids[target]] = [ids[target], ids[index]];
		reorder.mutate(ids);
	};

	const totalPoints = questions.reduce((sum, q) => sum + (q.points ?? 1), 0);

	return (
		<StudioShell
			title={
				assessment?.title ||
				t("assessment.untitled", { defaultValue: "Assessment" })
			}
			area={area}
			action={
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() =>
							navigate({
								to:
									area === "admin"
										? "/admin/attempt-reports/$assessmentId"
										: "/instructor/attempt-reports/$assessmentId",
								params: { assessmentId },
							})
						}
					>
						<ShieldCheck className="size-4" />
						{t("report.view_attempts", { defaultValue: "Attempts" })}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setDeleteOpen(true)}
						className="text-error hover:bg-error/5"
					>
						<Trash2 className="size-4" />
						{t("assessment.delete", { defaultValue: "Delete" })}
					</Button>
				</div>
			}
		>
			{isPending || !assessment ? (
				<div className="space-y-4">
					<Skeleton className="h-28 rounded-card" />
					<Skeleton className="h-64 rounded-card" />
				</div>
			) : (
				<div className="space-y-6">
					<section className="rounded-card border border-brand-primary/15 bg-card p-4 shadow-card sm:p-6">
						<p className="font-stats font-semibold text-brand-primary text-xs uppercase">
							{t(`assessment.scope_${assessment.scope}`, {
								defaultValue: assessment.scope,
							})}
						</p>
						<h2 className="mt-2 font-display text-2xl text-foreground">
							{assessment.title ||
								t("assessment.untitled", {
									defaultValue: "Untitled assessment",
								})}
						</h2>
						<div className="mt-3 flex flex-wrap gap-2 text-sm">
							<Stat
								label={t("assessment.questions", { defaultValue: "Questions" })}
								value={String(questions.length)}
							/>
							<Stat
								label={t("assessment.points", { defaultValue: "Points" })}
								value={String(totalPoints)}
							/>
							<Stat
								label={t("assessment.pass_mark", { defaultValue: "Pass mark" })}
								value={`${assessment.passMark}%`}
							/>
							{assessment.timeLimitMinutes ? (
								<Stat
									label={t("assessment.time", { defaultValue: "Time" })}
									value={`${assessment.timeLimitMinutes}m`}
								/>
							) : null}
						</div>
					</section>

					<AssessmentSettingsPanel assessment={assessment} />

					<section className="rounded-card border border-border bg-card shadow-card">
						<header className="flex flex-col gap-3 border-border border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
							<div>
								<h2 className="font-display text-lg text-foreground">
									{t("assessment.questions", { defaultValue: "Questions" })}{" "}
									<span className="text-muted-foreground">
										({questions.length})
									</span>
								</h2>
								<p className="text-muted-foreground text-sm">
									{t("assessment.questions_hint", {
										defaultValue:
											"Add questions by hand, or draft them from a lesson with AI.",
									})}
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								{questions.length > 0 ? (
									<ReadingLanguageToggle
										lang={lang}
										setLang={setLang}
										loading={trLoading}
									/>
								) : null}
								<Button
									variant="outline"
									size="sm"
									onClick={() => setAiOpen(true)}
								>
									<Sparkles className="size-4" />
									{t("assessment.ai_generate", {
										defaultValue: "Generate with AI",
									})}
								</Button>
								<Button size="sm" onClick={() => setEditing("new")}>
									<Plus className="size-4" />
									{t("assessment.add_question", {
										defaultValue: "Add question",
									})}
								</Button>
							</div>
						</header>

						{questions.length === 0 ? (
							<p className="px-6 py-14 text-center text-muted-foreground text-sm">
								{t("assessment.no_questions", {
									defaultValue:
										"No questions yet. Add one or generate from a lesson.",
								})}
							</p>
						) : (
							<ol className="divide-y divide-slate-100">
								{questions.map((q, index) => (
									<QuestionRow
										key={q.id}
										question={q}
										index={index}
										tr={tr}
										isFirst={index === 0}
										isLast={index === questions.length - 1}
										reordering={reorder.isPending}
										onMove={(dir) => move(index, dir)}
										onEdit={() => setEditing(q)}
										onDelete={() => removeQuestion.mutate(q.id)}
									/>
								))}
							</ol>
						)}
					</section>
				</div>
			)}

			{editing !== null && assessment ? (
				<QuestionDialog
					assessmentId={assessmentId}
					question={editing === "new" ? null : editing}
					onClose={() => setEditing(null)}
					onSaved={() => {
						setEditing(null);
						invalidate();
					}}
				/>
			) : null}

			{aiOpen && assessment ? (
				<AiGenerateDialog
					assessmentId={assessmentId}
					assessment={assessment}
					onClose={() => setAiOpen(false)}
					onDone={(count) => {
						setAiOpen(false);
						invalidate();
						toast.success(
							t("assessment.ai_added", {
								defaultValue: "Added {{count}} questions",
								count,
							}),
						);
					}}
				/>
			) : null}

			<ConfirmDialog
				open={deleteOpen}
				title={t("assessment.delete_title", {
					defaultValue: "Delete assessment?",
				})}
				description={t("assessment.delete_desc", {
					defaultValue: "This removes the assessment and all its questions.",
				})}
				confirmLabel={t("assessment.delete", { defaultValue: "Delete" })}
				cancelLabel={t("assessment.cancel", { defaultValue: "Cancel" })}
				isPending={removeAssessment.isPending}
				tone="danger"
				onOpenChange={setDeleteOpen}
				onConfirm={() => removeAssessment.mutate()}
			/>
		</StudioShell>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<span className="rounded-btn border border-border bg-muted px-3 py-1.5">
			<b className="font-stats font-bold text-foreground">{value}</b>{" "}
			<span className="text-muted-foreground">{label}</span>
		</span>
	);
}

const TYPE_KEY: Record<QuestionType, string> = {
	mcq: "type_mcq",
	true_false: "type_tf",
	short_answer: "type_short",
};

function QuestionRow({
	question,
	index,
	tr,
	isFirst,
	isLast,
	reordering,
	onMove,
	onEdit,
	onDelete,
}: {
	question: QuestionNode;
	index: number;
	tr: (text: string) => string;
	isFirst: boolean;
	isLast: boolean;
	reordering: boolean;
	onMove: (dir: -1 | 1) => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const { t } = useTranslation("authoring");
	const type = (question.type ?? "short_answer") as QuestionType;
	const options = Array.isArray(question.optionsJson)
		? question.optionsJson
		: [];

	return (
		<li className="flex gap-3 px-4 py-3 sm:px-6">
			<div className="flex flex-col items-center pt-1">
				<button
					type="button"
					aria-label="Move up"
					disabled={isFirst || reordering}
					onClick={() => onMove(-1)}
					className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-brand-primary disabled:opacity-30"
				>
					<ArrowUp className="size-3.5" />
				</button>
				<span className="py-0.5 font-stats font-bold text-muted-foreground text-xs">
					{index + 1}
				</span>
				<button
					type="button"
					aria-label="Move down"
					disabled={isLast || reordering}
					onClick={() => onMove(1)}
					className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-brand-primary disabled:opacity-30"
				>
					<ArrowDown className="size-3.5" />
				</button>
			</div>

			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="rounded-full bg-brand-primary/10 px-2 py-0.5 font-medium text-brand-primary text-xs">
						{t(`assessment.${TYPE_KEY[type]}`, { defaultValue: type })}
					</span>
					<span className="text-muted-foreground text-xs">
						{t("assessment.pts", {
							defaultValue: "{{n}} pt",
							n: question.points ?? 1,
						})}
					</span>
				</div>
				<p className="mt-1.5 break-words font-medium text-foreground text-sm">
					{tr(question.body)}
				</p>
				{type === "mcq" && options.length > 0 ? (
					<ul className="mt-2 space-y-1">
						{options.map((opt) => {
							const correct = opt === question.correctAnswer;
							return (
								<li
									key={opt}
									className={cn(
										"flex items-center gap-2 text-sm",
										correct
											? "font-medium text-success"
											: "text-muted-foreground",
									)}
								>
									{correct ? (
										<Check className="size-3.5 shrink-0" />
									) : (
										<span className="size-3.5 shrink-0 rounded-full border border-border" />
									)}
									<span className="break-words">{tr(opt)}</span>
								</li>
							);
						})}
					</ul>
				) : (
					<p className="mt-1.5 text-muted-foreground text-sm">
						<span className="text-muted-foreground">
							{t("assessment.answer", { defaultValue: "Answer" })}:{" "}
						</span>
						<span className="font-medium text-success">
							{question.correctAnswer ? tr(question.correctAnswer) : "—"}
						</span>
					</p>
				)}
			</div>

			<div className="flex shrink-0 flex-col gap-1">
				<button
					type="button"
					aria-label={t("assessment.edit", { defaultValue: "Edit" })}
					onClick={onEdit}
					className="flex size-8 items-center justify-center rounded-btn text-muted-foreground transition-colors hover:bg-accent hover:text-brand-primary"
				>
					<Pencil className="size-4" />
				</button>
				<button
					type="button"
					aria-label={t("assessment.delete", { defaultValue: "Delete" })}
					onClick={onDelete}
					className="flex size-8 items-center justify-center rounded-btn text-muted-foreground transition-colors hover:bg-error/5 hover:text-error"
				>
					<Trash2 className="size-4" />
				</button>
			</div>
		</li>
	);
}

// ── Modals ──────────────────────────────────────────────────────────────────
function Modal({
	title,
	onClose,
	children,
}: {
	title: string;
	onClose: () => void;
	children: ReactNode;
}) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
			<div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-card bg-card shadow-2xl sm:rounded-card">
				<header className="flex items-center justify-between border-border border-b px-5 py-3.5">
					<h3 className="font-display text-foreground text-lg">{title}</h3>
					<button
						type="button"
						aria-label="Close"
						onClick={onClose}
						className="flex size-8 items-center justify-center rounded-btn text-muted-foreground hover:bg-accent"
					>
						<X className="size-4" />
					</button>
				</header>
				<div className="overflow-y-auto p-5">{children}</div>
			</div>
		</div>
	);
}

function QuestionDialog({
	assessmentId,
	question,
	onClose,
	onSaved,
}: {
	assessmentId: string;
	question: QuestionNode | null;
	onClose: () => void;
	onSaved: () => void;
}) {
	const { t } = useTranslation("authoring");
	const [type, setType] = useState<QuestionType>(
		(question?.type as QuestionType) ?? "mcq",
	);
	const [body, setBody] = useState(question?.body ?? "");
	const [points, setPoints] = useState(String(question?.points ?? 1));
	const initialOptions = Array.isArray(question?.optionsJson)
		? (question?.optionsJson as string[])
		: ["", "", "", ""];
	const [options, setOptions] = useState<string[]>(
		initialOptions.length ? initialOptions : ["", "", "", ""],
	);
	const [correct, setCorrect] = useState(question?.correctAnswer ?? "");

	const save = useMutation({
		mutationFn: () => {
			const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
			const payload: QuestionInput = {
				type,
				body: body.trim(),
				points: Number(points) || 1,
				correctAnswer:
					type === "mcq"
						? correct.trim()
						: type === "true_false"
							? correct || "true"
							: correct.trim(),
				...(type === "mcq" ? { options: cleanOptions } : {}),
			};
			return question
				? updateQuestion(question.id, payload)
				: addQuestion(assessmentId, payload);
		},
		onSuccess: onSaved,
		onError: (e) => toast.error(e.message),
	});

	const valid =
		body.trim().length > 0 &&
		(type === "mcq"
			? options.filter((o) => o.trim()).length >= 2 && correct.trim().length > 0
			: correct.trim().length > 0);

	return (
		<Modal
			title={
				question
					? t("assessment.edit_question", { defaultValue: "Edit question" })
					: t("assessment.add_question", { defaultValue: "Add question" })
			}
			onClose={onClose}
		>
			<div className="space-y-4">
				<div>
					<p className="mb-1.5 font-medium text-foreground text-sm">
						{t("assessment.q_type", { defaultValue: "Type" })}
					</p>
					<div className="grid grid-cols-3 gap-2">
						{QUESTION_TYPES.map((qt) => (
							<button
								key={qt}
								type="button"
								onClick={() => {
									setType(qt);
									setCorrect(qt === "true_false" ? "true" : "");
								}}
								className={cn(
									"rounded-btn border px-2 py-2 text-xs transition-colors",
									type === qt
										? "border-brand-primary bg-brand-primary/10 font-medium text-brand-primary"
										: "border-border text-muted-foreground hover:border-border",
								)}
							>
								{t(`assessment.${TYPE_KEY[qt]}`, { defaultValue: qt })}
							</button>
						))}
					</div>
				</div>

				<label className="block">
					<span className="mb-1.5 block font-medium text-foreground text-sm">
						{t("assessment.q_body", { defaultValue: "Question" })}
					</span>
					<textarea
						value={body}
						onChange={(e) => setBody(e.target.value)}
						rows={2}
						className="w-full resize-none rounded-input border border-border px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-brand-primary"
					/>
				</label>

				{type === "mcq" ? (
					<div>
						<p className="mb-1.5 font-medium text-foreground text-sm">
							{t("assessment.q_options", {
								defaultValue: "Options (pick the correct one)",
							})}
						</p>
						<div className="space-y-2">
							{options.map((opt, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: options are positional and editable.
								<div key={i} className="flex items-center gap-2">
									<button
										type="button"
										aria-label="Mark correct"
										onClick={() => setCorrect(opt)}
										className={cn(
											"flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
											opt && opt === correct
												? "border-success bg-success text-white"
												: "border-border text-transparent hover:border-success",
										)}
									>
										<Check className="size-3.5" />
									</button>
									<input
										value={opt}
										onChange={(e) => {
											const next = [...options];
											const was = next[i];
											next[i] = e.target.value;
											setOptions(next);
											if (correct === was) setCorrect(e.target.value);
										}}
										placeholder={t("assessment.option_ph", {
											defaultValue: "Option {{n}}",
											n: i + 1,
										})}
										className="h-10 flex-1 rounded-input border border-border px-3 text-sm outline-none focus:border-brand-primary"
									/>
									{options.length > 2 ? (
										<button
											type="button"
											aria-label="Remove option"
											onClick={() => {
												setOptions(options.filter((_, idx) => idx !== i));
											}}
											className="flex size-7 items-center justify-center rounded-btn text-muted-foreground hover:text-error"
										>
											<X className="size-4" />
										</button>
									) : null}
								</div>
							))}
						</div>
						{options.length < 6 ? (
							<button
								type="button"
								onClick={() => setOptions([...options, ""])}
								className="mt-2 inline-flex items-center gap-1 font-medium text-brand-primary text-sm"
							>
								<Plus className="size-3.5" />
								{t("assessment.add_option", { defaultValue: "Add option" })}
							</button>
						) : null}
					</div>
				) : type === "true_false" ? (
					<div>
						<p className="mb-1.5 font-medium text-foreground text-sm">
							{t("assessment.correct_answer", {
								defaultValue: "Correct answer",
							})}
						</p>
						<div className="grid grid-cols-2 gap-2">
							{["true", "false"].map((v) => (
								<button
									key={v}
									type="button"
									onClick={() => setCorrect(v)}
									className={cn(
										"rounded-btn border px-3 py-2.5 font-medium text-sm transition-colors",
										correct === v
											? "border-brand-primary bg-brand-primary/10 text-brand-primary"
											: "border-border text-muted-foreground hover:border-border",
									)}
								>
									{t(`assessment.${v}`, { defaultValue: v })}
								</button>
							))}
						</div>
					</div>
				) : (
					<label className="block">
						<span className="mb-1.5 block font-medium text-foreground text-sm">
							{t("assessment.expected_answer", {
								defaultValue: "Expected answer",
							})}
						</span>
						<input
							value={correct}
							onChange={(e) => setCorrect(e.target.value)}
							className="h-10 w-full rounded-input border border-border px-3 text-sm outline-none focus:border-brand-primary"
						/>
					</label>
				)}

				<label className="block w-32">
					<span className="mb-1.5 block font-medium text-foreground text-sm">
						{t("assessment.points", { defaultValue: "Points" })}
					</span>
					<input
						type="number"
						min={1}
						max={100}
						value={points}
						onChange={(e) => setPoints(e.target.value)}
						className="h-10 w-full rounded-input border border-border px-3 text-sm outline-none focus:border-brand-primary"
					/>
				</label>

				<div className="flex justify-end gap-2 pt-1">
					<Button variant="ghost" onClick={onClose}>
						{t("assessment.cancel", { defaultValue: "Cancel" })}
					</Button>
					<Button
						onClick={() => save.mutate()}
						disabled={!valid || save.isPending}
					>
						{save.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : null}
						{t("assessment.save_question", { defaultValue: "Save question" })}
					</Button>
				</div>
			</div>
		</Modal>
	);
}

function AiGenerateDialog({
	assessmentId,
	assessment,
	onClose,
	onDone,
}: {
	assessmentId: string;
	assessment: AssessmentDetail;
	onClose: () => void;
	onDone: (count: number) => void;
}) {
	const { t } = useTranslation("authoring");
	const lessons = assessment.sourceLessons ?? [];
	const firstWithTranscript =
		lessons.find((l) => l.hasTranscript)?.id ?? assessment.lessonId ?? "";
	const [lessonId, setLessonId] = useState(firstWithTranscript);
	const [count, setCount] = useState("5");
	const [types, setTypes] = useState<QuestionType[]>([
		"mcq",
		"true_false",
		"short_answer",
	]);

	const toggleType = (qt: QuestionType) =>
		setTypes((prev) =>
			prev.includes(qt) ? prev.filter((x) => x !== qt) : [...prev, qt],
		);

	const generate = useMutation({
		mutationFn: () =>
			generateQuestions(assessmentId, {
				lessonId: lessonId || undefined,
				count: Number(count) || 5,
				types,
			}),
		onSuccess: (created) => onDone(created.length),
		onError: (e) => toast.error(e.message),
	});

	const hasUsableLesson = lessons.some((l) => l.hasTranscript);
	const canGenerate =
		types.length > 0 &&
		(lessonId ? lessons.find((l) => l.id === lessonId)?.hasTranscript : false);

	return (
		<Modal
			title={t("assessment.ai_title", {
				defaultValue: "Generate questions with AI",
			})}
			onClose={onClose}
		>
			<div className="space-y-4">
				<div className="flex items-start gap-2 rounded-card border border-brand-primary/15 bg-brand-primary/5 p-3 text-muted-foreground text-sm">
					<Sparkles className="mt-0.5 size-4 shrink-0 text-brand-primary" />
					<p>
						{t("assessment.ai_blurb", {
							defaultValue:
								"AI drafts questions from the lesson transcript. Review and edit them before learners take the assessment.",
						})}
					</p>
				</div>

				{lessons.length === 0 ? (
					<p className="flex items-center gap-2 rounded-card border border-warning/30 bg-warning/10 p-3 text-amber-800 dark:text-amber-200 text-sm">
						<CircleHelp className="size-4 shrink-0" />
						{t("assessment.ai_no_lessons", {
							defaultValue:
								"No source lessons found for this assessment. Add questions by hand instead.",
						})}
					</p>
				) : (
					<label className="block">
						<span className="mb-1.5 block font-medium text-foreground text-sm">
							{t("assessment.ai_lesson", { defaultValue: "Source lesson" })}
						</span>
						<select
							value={lessonId}
							onChange={(e) => setLessonId(e.target.value)}
							className="h-11 w-full rounded-input border border-border bg-card px-3 text-foreground text-sm outline-none focus:border-brand-primary"
						>
							<option value="">
								{t("assessment.ai_pick_lesson", {
									defaultValue: "Choose a lesson…",
								})}
							</option>
							{lessons.map((l) => (
								<option key={l.id} value={l.id} disabled={!l.hasTranscript}>
									{l.title}
									{l.hasTranscript
										? ""
										: ` — ${t("assessment.ai_no_transcript", { defaultValue: "no transcript" })}`}
								</option>
							))}
						</select>
						{!hasUsableLesson ? (
							<span className="mt-1 block text-amber-700 dark:text-amber-300 text-xs">
								{t("assessment.ai_need_transcript", {
									defaultValue:
										"None of these lessons have a transcript yet — add one to generate from it.",
								})}
							</span>
						) : null}
					</label>
				)}

				<div className="grid grid-cols-2 gap-3">
					<label className="block">
						<span className="mb-1.5 block font-medium text-foreground text-sm">
							{t("assessment.ai_count", { defaultValue: "How many" })}
						</span>
						<input
							type="number"
							min={1}
							max={20}
							value={count}
							onChange={(e) => setCount(e.target.value)}
							className="h-11 w-full rounded-input border border-border px-3.5 text-foreground outline-none focus:border-brand-primary"
						/>
					</label>
				</div>

				<div>
					<p className="mb-1.5 font-medium text-foreground text-sm">
						{t("assessment.ai_types", { defaultValue: "Question types" })}
					</p>
					<div className="grid grid-cols-3 gap-2">
						{QUESTION_TYPES.map((qt) => (
							<button
								key={qt}
								type="button"
								onClick={() => toggleType(qt)}
								className={cn(
									"rounded-btn border px-2 py-2 text-xs transition-colors",
									types.includes(qt)
										? "border-brand-primary bg-brand-primary/10 font-medium text-brand-primary"
										: "border-border text-muted-foreground hover:border-border",
								)}
							>
								{t(`assessment.${TYPE_KEY[qt]}`, { defaultValue: qt })}
							</button>
						))}
					</div>
				</div>

				<div className="flex justify-end gap-2 pt-1">
					<Button variant="ghost" onClick={onClose}>
						{t("assessment.cancel", { defaultValue: "Cancel" })}
					</Button>
					<Button
						onClick={() => generate.mutate()}
						disabled={!canGenerate || generate.isPending}
					>
						{generate.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Sparkles className="size-4" />
						)}
						{t("assessment.ai_generate", { defaultValue: "Generate" })}
					</Button>
				</div>
			</div>
		</Modal>
	);
}
