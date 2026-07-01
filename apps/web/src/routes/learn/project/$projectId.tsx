import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	CheckCircle2,
	Clock,
	FileUp,
	Link2,
	Loader2,
	Paperclip,
	Upload,
	Users,
	X,
	XCircle,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { RequireAuth } from "@/components/auth/require-auth";
import { ReadingLanguageToggle } from "@/components/learn/reading-language-toggle";
import { Button } from "@/components/ui/button";
import { useReadingTranslation } from "@/hooks/use-reading-translation";
import {
	getProjectInfo,
	type ProjectInfo,
	submitProject,
	uploadProjectFile,
} from "@/lib/content-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/learn/project/$projectId")({
	component: ProjectSubmitRoute,
});

function ProjectSubmitRoute() {
	const { projectId } = Route.useParams();
	return (
		<RequireAuth>
			<ProjectSubmitPage projectId={projectId} />
		</RequireAuth>
	);
}

function ProjectSubmitPage({ projectId }: { projectId: string }) {
	const navigate = useNavigate();
	const { data: info, isPending } = useQuery({
		queryKey: ["project-info", projectId],
		queryFn: () => getProjectInfo(projectId),
	});

	return (
		<div className="min-h-dvh bg-muted">
			<header className="sticky top-0 z-10 border-border border-b bg-card/90 backdrop-blur">
				<div className="mx-auto flex h-14 max-w-2xl items-center px-4">
					<button
						type="button"
						onClick={() => navigate({ to: "/dashboard" })}
						className="flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
					>
						<ArrowLeft className="size-4" />
						<span className="hidden sm:inline">Exit</span>
					</button>
				</div>
			</header>
			<main className="mx-auto max-w-2xl px-4 py-6">
				{isPending || !info ? (
					<div className="flex h-64 items-center justify-center">
						<Loader2 className="size-7 animate-spin text-brand-primary" />
					</div>
				) : (
					<ProjectBody info={info} projectId={projectId} />
				)}
			</main>
		</div>
	);
}

function ProjectBody({
	info,
	projectId,
}: {
	info: ProjectInfo;
	projectId: string;
}) {
	const { t } = useTranslation("authoring");
	const queryClient = useQueryClient();
	const fileRef = useRef<HTMLInputElement>(null);

	// Read-only translation (§11) of the brief, rubric labels + grader feedback.
	const briefTexts = useMemo(
		() => [
			info.title,
			info.description ?? "",
			...(info.rubric ?? []).map((c) => c.label),
			info.mySubmission?.feedback ?? "",
		],
		[info.title, info.description, info.rubric, info.mySubmission?.feedback],
	);
	const {
		lang,
		setLang,
		tr,
		loading: trLoading,
	} = useReadingTranslation(briefTexts);

	const mine = info.mySubmission;
	const locked = mine?.passed === true;
	const [text, setText] = useState(mine?.textContent ?? "");
	const [url, setUrl] = useState(mine?.urlSubmission ?? "");
	const [files, setFiles] = useState<{ key: string; name: string }[]>(
		mine?.files.map((f) => ({ key: f.name, name: f.name })) ?? [],
	);

	const upload = useMutation({
		mutationFn: (file: File) => uploadProjectFile(projectId, file),
		onSuccess: (res) =>
			setFiles((prev) => [...prev, { key: res.key, name: res.name }]),
		onError: (e) => toast.error(e.message),
	});

	const submit = useMutation({
		mutationFn: () =>
			submitProject(projectId, {
				textContent: text.trim() || undefined,
				urlSubmission: url.trim() || undefined,
				files: files.length ? files : undefined,
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["project-info", projectId] });
			toast.success(t("submit.sent", { defaultValue: "Submission sent" }));
		},
		onError: (e) => toast.error(e.message),
	});

	const accepts = (typ: string) => info.submissionTypes.includes(typ);

	return (
		<div className="space-y-5">
			<section className="rounded-card border border-border bg-card p-6 shadow-card">
				<div className="flex items-start justify-between gap-3">
					<p className="font-stats font-semibold text-brand-primary text-xs uppercase">
						{t("submit.eyebrow", { defaultValue: "Project" })}
					</p>
					<ReadingLanguageToggle
						lang={lang}
						setLang={setLang}
						loading={trLoading}
					/>
				</div>
				<h1 className="mt-2 font-display text-2xl text-foreground">
					{tr(info.title)}
				</h1>
				{info.description ? (
					<p className="mt-2 whitespace-pre-wrap text-muted-foreground text-sm leading-relaxed">
						{tr(info.description)}
					</p>
				) : null}
				<div className="mt-4 flex flex-wrap gap-2 text-sm">
					<span className="rounded-btn border border-border bg-muted px-3 py-1.5 text-muted-foreground">
						{t("submit.pass_mark", {
							defaultValue: "Pass mark {{n}}%",
							n: info.passMark,
						})}
					</span>
					{info.dueAt ? (
						<span className="flex items-center gap-1.5 rounded-btn border border-border bg-muted px-3 py-1.5 text-muted-foreground">
							<Clock className="size-3.5" />
							{new Date(info.dueAt).toLocaleDateString()}
						</span>
					) : null}
				</div>
			</section>

			{/* Rubric (read-only) */}
			{info.rubric && info.rubric.length > 0 ? (
				<section className="rounded-card border border-border bg-card p-5 shadow-card">
					<h2 className="mb-2 font-display text-foreground">
						{t("submit.rubric", { defaultValue: "How you'll be graded" })}
					</h2>
					<ul className="space-y-1.5 text-sm">
						{info.rubric.map((c) => (
							<li
								key={c.id ?? c.label}
								className="flex items-center justify-between gap-3"
							>
								<span className="text-foreground">{tr(c.label)}</span>
								<span className="font-stats font-semibold text-muted-foreground">
									{c.maxPoints} pts
								</span>
							</li>
						))}
					</ul>
				</section>
			) : null}

			{/* Status */}
			{mine ? (
				<section
					className={cn(
						"rounded-card border p-4 text-sm",
						mine.graded
							? mine.passed
								? "border-success/30 bg-success/5"
								: "border-error/30 bg-error/5"
							: "border-amber-200 bg-amber-50",
					)}
				>
					{mine.graded ? (
						<div>
							<p
								className={cn(
									"flex items-center gap-2 font-medium",
									mine.passed ? "text-success" : "text-error",
								)}
							>
								{mine.passed ? (
									<CheckCircle2 className="size-4" />
								) : (
									<XCircle className="size-4" />
								)}
								{mine.passed
									? t("submit.passed", { defaultValue: "Passed" })
									: t("submit.failed", { defaultValue: "Not passed" })}
								{mine.score != null ? ` · ${mine.score}%` : ""}
							</p>
							{mine.feedback ? (
								<p className="mt-2 whitespace-pre-wrap text-muted-foreground">
									{tr(mine.feedback)}
								</p>
							) : null}
						</div>
					) : (
						<p className="flex items-center gap-2 text-amber-800">
							<Clock className="size-4" />
							{t("submit.pending", {
								defaultValue: "Submitted — awaiting grading.",
							})}
						</p>
					)}
				</section>
			) : null}

			{/* Peer-review obligation (§4.5) */}
			{info.peerReview &&
			info.peerReview.completed < info.peerReview.required ? (
				<Link
					to="/learn/peer-review/$projectId"
					params={{ projectId }}
					className="flex items-center gap-3 rounded-card border border-brand-primary/20 bg-brand-primary/5 p-4 transition-colors hover:bg-brand-primary/10"
				>
					<Users className="size-5 shrink-0 text-brand-primary" />
					<span className="flex-1 text-foreground text-sm">
						{t("submit.peer_cta", {
							defaultValue:
								"Complete {{n}} peer review(s) to finish this project.",
							n: info.peerReview.required - info.peerReview.completed,
						})}
					</span>
					<span className="font-stats font-semibold text-brand-primary text-sm">
						{info.peerReview.completed}/{info.peerReview.required} →
					</span>
				</Link>
			) : null}

			{/* Submission form */}
			{locked ? null : (
				<section className="space-y-4 rounded-card border border-border bg-card p-5 shadow-card">
					<h2 className="font-display text-foreground">
						{t("submit.your_work", { defaultValue: "Your submission" })}
					</h2>

					{accepts("text_submission") ? (
						<label className="block">
							<span className="mb-1.5 block font-medium text-foreground text-sm">
								{t("submit.text", { defaultValue: "Write-up" })}
							</span>
							<textarea
								value={text}
								onChange={(e) => setText(e.target.value)}
								rows={5}
								className="w-full resize-none rounded-input border border-border px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-brand-primary"
							/>
						</label>
					) : null}

					{accepts("url_submission") ? (
						<label className="block">
							<span className="mb-1.5 block font-medium text-foreground text-sm">
								{t("submit.url", { defaultValue: "Link / URL" })}
							</span>
							<div className="flex items-center gap-2 rounded-input border border-border px-3 focus-within:border-brand-primary">
								<Link2 className="size-4 text-muted-foreground" />
								<input
									value={url}
									onChange={(e) => setUrl(e.target.value)}
									placeholder="https://github.com/…"
									className="h-11 flex-1 bg-transparent text-foreground text-sm outline-none"
								/>
							</div>
						</label>
					) : null}

					{accepts("file_upload") ? (
						<div>
							<p className="mb-1.5 font-medium text-foreground text-sm">
								{t("submit.files", { defaultValue: "Files" })}
							</p>
							<ul className="mb-2 space-y-1.5">
								{files.map((f, i) => (
									<li
										// biome-ignore lint/suspicious/noArrayIndexKey: positional file rows.
										key={i}
										className="flex items-center gap-2 rounded-btn border border-border px-3 py-2 text-sm"
									>
										<Paperclip className="size-4 shrink-0 text-muted-foreground" />
										<span className="min-w-0 flex-1 truncate text-foreground">
											{f.name}
										</span>
										<button
											type="button"
											aria-label={t("submit.remove", {
												defaultValue: "Remove",
											})}
											onClick={() =>
												setFiles(files.filter((_, idx) => idx !== i))
											}
											className="text-muted-foreground hover:text-error"
										>
											<X className="size-4" />
										</button>
									</li>
								))}
							</ul>
							<input
								ref={fileRef}
								type="file"
								className="hidden"
								onChange={(e) => {
									const file = e.target.files?.[0];
									if (file) upload.mutate(file);
									e.target.value = "";
								}}
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => fileRef.current?.click()}
								disabled={upload.isPending}
							>
								{upload.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<FileUp className="size-4" />
								)}
								{t("submit.add_file", { defaultValue: "Add file" })}
								{info.allowedFileTypes.length > 0
									? ` (${info.allowedFileTypes.join(", ")})`
									: ""}
							</Button>
						</div>
					) : null}

					<div className="flex justify-end">
						<Button onClick={() => submit.mutate()} disabled={submit.isPending}>
							{submit.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Upload className="size-4" />
							)}
							{mine
								? t("submit.resubmit", { defaultValue: "Resubmit" })
								: t("submit.send", { defaultValue: "Submit project" })}
						</Button>
					</div>
				</section>
			)}
		</div>
	);
}
