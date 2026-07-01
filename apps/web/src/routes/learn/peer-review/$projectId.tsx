import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	CheckCircle2,
	ExternalLink,
	Loader2,
	Paperclip,
	Users,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { RequireAuth } from "@/components/auth/require-auth";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
	listMyPeerReviews,
	type MyPeerReviews,
	type PeerReviewItem,
	type RubricCriterion,
	submitPeerReview,
} from "@/lib/content-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/learn/peer-review/$projectId")({
	component: PeerReviewRoute,
});

function PeerReviewRoute() {
	const { projectId } = Route.useParams();
	return (
		<RequireAuth>
			<PeerReviewPage projectId={projectId} />
		</RequireAuth>
	);
}

function PeerReviewPage({ projectId }: { projectId: string }) {
	const navigate = useNavigate();
	const { data, isPending } = useQuery({
		queryKey: ["peer-reviews", projectId],
		queryFn: () => listMyPeerReviews(projectId),
	});

	return (
		<div className="min-h-dvh bg-muted">
			<header className="sticky top-0 z-10 border-border border-b bg-card/90 backdrop-blur">
				<div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
					<button
						type="button"
						onClick={() => navigate({ to: "/dashboard" })}
						className="flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
					>
						<ArrowLeft className="size-4" />
						<span className="hidden sm:inline">Exit</span>
					</button>
					{data ? (
						<span className="font-stats font-semibold text-brand-primary text-sm">
							{data.completed}/{data.required}
						</span>
					) : null}
				</div>
			</header>
			<main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
				{isPending || !data ? (
					<div className="flex h-64 items-center justify-center">
						<Loader2 className="size-7 animate-spin text-brand-primary" />
					</div>
				) : (
					<PeerReviewBody data={data} projectId={projectId} />
				)}
			</main>
		</div>
	);
}

function PeerReviewBody({
	data,
	projectId,
}: {
	data: MyPeerReviews;
	projectId: string;
}) {
	const { t } = useTranslation("authoring");
	const rubric = data.rubric ?? [];

	return (
		<>
			<section className="rounded-card border border-border bg-card p-5 shadow-card">
				<p className="flex items-center gap-2 font-stats font-semibold text-brand-primary text-xs uppercase">
					<Users className="size-4" />
					{t("peer.eyebrow", { defaultValue: "Peer review" })}
				</p>
				<h1 className="mt-2 font-display text-2xl text-foreground">
					{data.projectTitle}
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					{t("peer.intro", {
						defaultValue:
							"Review your peers' work fairly. You must finish {{n}} to complete this project.",
						n: data.required,
					})}
				</p>
			</section>

			{data.reviews.length === 0 ? (
				<EmptyState
					title={t("peer.none", {
						defaultValue:
							"No peer submissions to review yet — check back soon.",
					})}
				/>
			) : (
				data.reviews.map((review) => (
					<ReviewCard
						key={review.reviewId}
						review={review}
						rubric={rubric}
						projectId={projectId}
					/>
				))
			)}
		</>
	);
}

function ReviewCard({
	review,
	rubric,
	projectId,
}: {
	review: PeerReviewItem;
	rubric: RubricCriterion[];
	projectId: string;
}) {
	const { t } = useTranslation("authoring");
	const queryClient = useQueryClient();
	const [scores, setScores] = useState<Record<string, number>>(() => {
		const seed: Record<string, number> = {};
		for (const s of review.myScores) seed[s.criterionId] = s.points;
		return seed;
	});
	const [feedback, setFeedback] = useState(review.myFeedback ?? "");

	const save = useMutation({
		mutationFn: () =>
			submitPeerReview(review.reviewId, {
				rubricScores: rubric.map((c) => ({
					criterionId: c.id ?? "",
					points: scores[c.id ?? ""] ?? 0,
				})),
				feedback: feedback.trim() || undefined,
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["peer-reviews", projectId] });
			toast.success(t("peer.sent", { defaultValue: "Review submitted" }));
		},
		onError: (e) => toast.error(e.message),
	});

	return (
		<section
			className={cn(
				"rounded-card border bg-card p-5 shadow-card",
				review.done ? "border-success/30" : "border-border",
			)}
		>
			<div className="flex items-center justify-between">
				<h2 className="font-display text-foreground">
					{t("peer.submission", { defaultValue: "Peer submission" })}{" "}
					{review.label}
				</h2>
				{review.done ? (
					<span className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 font-medium text-success text-xs">
						<CheckCircle2 className="size-3.5" />
						{t("peer.done", { defaultValue: "Reviewed" })}
					</span>
				) : null}
			</div>

			{/* Submission content (anonymous) */}
			<div className="mt-3 space-y-2">
				{review.textContent ? (
					<p className="whitespace-pre-wrap rounded-card border border-border bg-muted p-3 text-foreground text-sm">
						{review.textContent}
					</p>
				) : null}
				{review.urlSubmission ? (
					<a
						href={review.urlSubmission}
						target="_blank"
						rel="noreferrer"
						className="flex items-center gap-2 rounded-card border border-border p-3 text-brand-primary text-sm hover:bg-accent"
					>
						<ExternalLink className="size-4 shrink-0" />
						<span className="truncate">{review.urlSubmission}</span>
					</a>
				) : null}
				{review.files.map((f) => (
					<a
						key={f.url}
						href={f.url}
						target="_blank"
						rel="noreferrer"
						className="flex items-center gap-2 rounded-card border border-border p-3 text-foreground text-sm hover:bg-accent"
					>
						<Paperclip className="size-4 shrink-0 text-muted-foreground" />
						<span className="truncate">{f.name}</span>
					</a>
				))}
			</div>

			{/* Rubric scoring */}
			<div className="mt-4 space-y-2">
				{rubric.map((c) => {
					const id = c.id ?? "";
					return (
						<div
							key={id}
							className="flex items-center justify-between gap-3 rounded-btn border border-border px-3 py-2"
						>
							<span className="font-medium text-foreground text-sm">
								{c.label}
							</span>
							<div className="flex items-center gap-1 text-sm">
								<input
									type="number"
									min={0}
									max={c.maxPoints}
									disabled={review.done}
									value={scores[id] ?? 0}
									onChange={(e) =>
										setScores((p) => ({
											...p,
											[id]: Math.max(
												0,
												Math.min(c.maxPoints, Number(e.target.value)),
											),
										}))
									}
									className="h-9 w-16 rounded-input border border-border px-2 text-right outline-none focus:border-brand-primary disabled:bg-muted"
								/>
								<span className="text-muted-foreground">/ {c.maxPoints}</span>
							</div>
						</div>
					);
				})}
			</div>

			<textarea
				value={feedback}
				onChange={(e) => setFeedback(e.target.value)}
				disabled={review.done}
				rows={2}
				placeholder={t("peer.feedback_ph", {
					defaultValue: "Feedback for your peer…",
				})}
				className="mt-3 w-full resize-none rounded-input border border-border px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-brand-primary disabled:bg-muted"
			/>

			{!review.done ? (
				<div className="mt-3 flex justify-end">
					<Button onClick={() => save.mutate()} disabled={save.isPending}>
						{save.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : null}
						{t("peer.submit", { defaultValue: "Submit review" })}
					</Button>
				</div>
			) : null}
		</section>
	);
}
