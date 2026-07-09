import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Ban,
	CheckCircle2,
	Loader2,
	ShieldAlert,
	ShieldCheck,
	X,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	type AttemptReportEvent,
	acceptAttempt,
	escalateAttempt,
	getAttemptReport,
	invalidateAttempt,
} from "@/lib/content-api";
import { cn } from "@/lib/utils";

/** Integrity score → traffic-light colour. */
function integrityTone(score: number) {
	if (score >= 85) return "text-success";
	if (score >= 60) return "text-amber-600 dark:text-amber-400";
	return "text-error";
}

const SEVERITY_DOT: Record<string, string> = {
	low: "bg-slate-400",
	medium: "bg-amber-500",
	high: "bg-error",
};

export function AttemptReportDialog({
	attemptId,
	onClose,
	onChanged,
}: {
	attemptId: string;
	onClose: () => void;
	onChanged?: () => void;
}) {
	const { t } = useTranslation("authoring");
	const queryClient = useQueryClient();
	const [pending, setPending] = useState<"invalidate" | "escalate" | null>(
		null,
	);
	const [reason, setReason] = useState("");

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	const { data: report, isPending } = useQuery({
		queryKey: ["attempt-report", attemptId],
		queryFn: () => getAttemptReport(attemptId),
	});

	const refresh = () => {
		queryClient.invalidateQueries({ queryKey: ["attempt-report", attemptId] });
		onChanged?.();
	};

	const accept = useMutation({
		mutationFn: () => acceptAttempt(attemptId),
		onSuccess: () => {
			toast.success(t("report.accepted", { defaultValue: "Attempt accepted" }));
			refresh();
		},
		onError: (e) => toast.error(e.message),
	});

	const invalidate = useMutation({
		mutationFn: () => invalidateAttempt(attemptId, reason.trim() || undefined),
		onSuccess: () => {
			toast.success(
				t("report.invalidated", { defaultValue: "Attempt invalidated" }),
			);
			setPending(null);
			setReason("");
			refresh();
		},
		onError: (e) => toast.error(e.message),
	});

	const escalate = useMutation({
		mutationFn: () => escalateAttempt(attemptId, reason.trim() || undefined),
		onSuccess: () => {
			toast.success(
				t("report.escalated", { defaultValue: "Escalated to admin" }),
			);
			setPending(null);
			setReason("");
			refresh();
		},
		onError: (e) => toast.error(e.message),
	});

	const busy = accept.isPending || invalidate.isPending || escalate.isPending;

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4">
			<div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-card bg-card shadow-2xl sm:rounded-card">
				<header className="flex items-center justify-between border-border border-b px-5 py-3.5">
					<h3 className="font-display text-lg text-foreground">
						{t("report.title", { defaultValue: "Integrity report" })}
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
					{isPending || !report ? (
						<div className="flex h-40 items-center justify-center">
							<Loader2 className="size-6 animate-spin text-brand-primary" />
						</div>
					) : (
						<div className="space-y-5">
							{/* Summary */}
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0">
									<p className="truncate font-medium text-foreground">
										{report.userName ||
											report.userEmail ||
											t("report.learner", { defaultValue: "Learner" })}
									</p>
									{report.userEmail ? (
										<p className="truncate text-muted-foreground text-sm">
											{report.userEmail}
										</p>
									) : null}
									<p className="mt-1 text-muted-foreground text-xs">
										{t("report.attempt_n", {
											defaultValue: "Attempt {{n}}",
											n: report.attemptNumber,
										})}
										{report.submittedAt
											? ` · ${new Date(report.submittedAt).toLocaleString()}`
											: ""}
										{report.autoSubmitted
											? ` · ${t("report.auto", { defaultValue: "auto-submitted" })}`
											: ""}
									</p>
								</div>
								<div className="text-right">
									<p
										className={cn(
											"font-stats font-bold text-3xl",
											integrityTone(report.integrityScore),
										)}
									>
										{report.integrityScore}
									</p>
									<p className="text-muted-foreground text-xs">
										{t("report.integrity", { defaultValue: "integrity" })}
									</p>
								</div>
							</div>

							<div className="flex flex-wrap gap-2 text-sm">
								<Stat
									label={t("report.score", { defaultValue: "Score" })}
									value={report.score == null ? "—" : `${report.score}%`}
								/>
								<Stat
									label={t("report.result", { defaultValue: "Result" })}
									value={
										report.passed
											? t("report.passed", { defaultValue: "Passed" })
											: t("report.failed", { defaultValue: "Failed" })
									}
								/>
								<Stat
									label={t("report.flags", { defaultValue: "Flags" })}
									value={String(report.flagCount)}
								/>
							</div>

							{report.ipAddress || report.userAgent ? (
								<p className="rounded-btn bg-muted px-3 py-2 text-muted-foreground text-xs">
									{report.ipAddress ? `IP ${report.ipAddress}` : ""}
									{report.userAgent ? ` · ${report.userAgent}` : ""}
								</p>
							) : null}

							{report.invalidated ? (
								<Banner
									tone="error"
									icon={<Ban className="size-4" />}
									title={t("report.is_invalidated", {
										defaultValue: "Invalidated — learner must retake",
									})}
									detail={report.invalidatedReason}
								/>
							) : null}
							{report.escalated ? (
								<Banner
									tone="amber"
									icon={<ShieldAlert className="size-4" />}
									title={t("report.is_escalated", {
										defaultValue: "Escalated to admin",
									})}
									detail={report.escalatedReason}
								/>
							) : null}

							{/* Flag timeline */}
							<div>
								<p className="mb-2 font-medium text-foreground text-sm">
									{t("report.timeline", { defaultValue: "Flag timeline" })}
								</p>
								{report.events.length === 0 ? (
									<p className="flex items-center gap-2 rounded-card border border-success/30 bg-success/5 px-3 py-2.5 text-muted-foreground text-sm">
										<ShieldCheck className="size-4 text-success" />
										{t("report.clean", {
											defaultValue: "No integrity flags recorded.",
										})}
									</p>
								) : (
									<ul className="space-y-2">
										{report.events.map((ev) => (
											<EventRow key={ev.id} event={ev} />
										))}
									</ul>
								)}
							</div>
						</div>
					)}
				</div>

				{/* Actions */}
				{report ? (
					<div className="border-border border-t p-4">
						{pending ? (
							<div className="space-y-2">
								<textarea
									value={reason}
									onChange={(e) => setReason(e.target.value)}
									rows={2}
									placeholder={t("report.reason_ph", {
										defaultValue: "Optional reason…",
									})}
									className="w-full resize-none rounded-input border border-border px-3 py-2 text-sm outline-none focus:border-brand-primary"
								/>
								<div className="flex justify-end gap-2">
									<Button variant="ghost" onClick={() => setPending(null)}>
										{t("report.cancel", { defaultValue: "Cancel" })}
									</Button>
									<Button
										onClick={() =>
											pending === "invalidate"
												? invalidate.mutate()
												: escalate.mutate()
										}
										disabled={busy}
										className={
											pending === "invalidate"
												? "bg-error hover:bg-error/90"
												: ""
										}
									>
										{busy ? <Loader2 className="size-4 animate-spin" /> : null}
										{pending === "invalidate"
											? t("report.confirm_invalidate", {
													defaultValue: "Invalidate attempt",
												})
											: t("report.confirm_escalate", {
													defaultValue: "Escalate",
												})}
									</Button>
								</div>
							</div>
						) : (
							<div className="flex flex-wrap justify-end gap-2">
								<Button
									variant="outline"
									onClick={() => setPending("escalate")}
									disabled={busy}
								>
									<ShieldAlert className="size-4" />
									{t("report.escalate", { defaultValue: "Escalate" })}
								</Button>
								<Button
									variant="outline"
									onClick={() => setPending("invalidate")}
									disabled={busy}
									className="border-error/40 text-error hover:bg-error/5"
								>
									<Ban className="size-4" />
									{t("report.invalidate", { defaultValue: "Invalidate" })}
								</Button>
								<Button onClick={() => accept.mutate()} disabled={busy}>
									{accept.isPending ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<CheckCircle2 className="size-4" />
									)}
									{t("report.accept", { defaultValue: "Accept" })}
								</Button>
							</div>
						)}
					</div>
				) : null}
			</div>
		</div>
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

function Banner({
	tone,
	icon,
	title,
	detail,
}: {
	tone: "error" | "amber";
	icon: ReactNode;
	title: string;
	detail?: string | null;
}) {
	return (
		<div
			className={cn(
				"flex items-start gap-2 rounded-card border p-3 text-sm",
				tone === "error"
					? "border-error/30 bg-error/5 text-error"
					: "border-warning/40 bg-warning/10 text-amber-800 dark:text-amber-200",
			)}
		>
			<span className="mt-0.5 shrink-0">{icon}</span>
			<div>
				<p className="font-medium">{title}</p>
				{detail ? <p className="mt-0.5 opacity-80">{detail}</p> : null}
			</div>
		</div>
	);
}

function EventRow({ event }: { event: AttemptReportEvent }) {
	const { t } = useTranslation("authoring");
	return (
		<li className="flex gap-3 rounded-card border border-border p-2.5">
			<span
				className={cn(
					"mt-1.5 size-2 shrink-0 rounded-full",
					SEVERITY_DOT[event.severity] ?? "bg-slate-400",
				)}
			/>
			<div className="min-w-0 flex-1">
				<p className="font-medium text-foreground text-sm">
					{t(`report.event_${event.eventType}`, {
						defaultValue: event.eventType.replace(/_/g, " "),
					})}
				</p>
				<p className="text-muted-foreground text-xs">
					{new Date(event.occurredAt).toLocaleTimeString()}
				</p>
			</div>
			{event.screenshotUrl ? (
				<a
					href={event.screenshotUrl}
					target="_blank"
					rel="noreferrer"
					className="shrink-0"
				>
					<img
						src={event.screenshotUrl}
						alt={t("report.snapshot", { defaultValue: "Proctoring snapshot" })}
						className="size-12 rounded-btn border border-border object-cover"
					/>
				</a>
			) : null}
		</li>
	);
}
