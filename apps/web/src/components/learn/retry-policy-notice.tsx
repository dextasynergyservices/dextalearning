import { AlertTriangle, Clock, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ProjectRetryState } from "@/lib/content-api";
import { cn } from "@/lib/utils";

function when(iso: string, language: string): string {
	return new Date(iso).toLocaleString(language, {
		dateStyle: "medium",
		timeStyle: "short",
	});
}

/**
 * The learner's standing under a retry policy (§4.5): how many tries are left,
 * when the wait between tries ends, or when a used-up allowance resets. Renders
 * nothing when the content has no policy or the learner has already passed —
 * the pass state speaks for itself.
 */
export function RetryPolicyNotice({
	retry,
	className,
}: {
	retry: ProjectRetryState;
	className?: string;
}) {
	const { t, i18n } = useTranslation("authoring");

	if (retry.reason === "already_passed") return null;

	// Blocked: waiting out the spacing between two tries.
	if (retry.reason === "cooldown" && retry.nextAttemptAt) {
		return (
			<Notice tone="warning" icon={Clock} className={className}>
				<p className="font-medium text-foreground">
					{t("retry.cooldown_title", { defaultValue: "Take a breather" })}
				</p>
				<p className="mt-0.5 text-muted-foreground">
					{t("retry.cooldown_body", {
						defaultValue: "You can try again from {{date}}.",
						date: when(retry.nextAttemptAt, i18n.language),
					})}
				</p>
			</Notice>
		);
	}

	// Blocked: allowance used up, but it resets after the lockout.
	if (retry.reason === "locked_out" && retry.lockedUntil) {
		return (
			<Notice tone="warning" icon={RotateCcw} className={className}>
				<p className="font-medium text-foreground">
					{t("retry.locked_title", {
						defaultValue: "You've used all your attempts",
					})}
				</p>
				<p className="mt-0.5 text-muted-foreground">
					{t("retry.locked_body", {
						defaultValue:
							"Your attempts reset on {{date}} — review the material and come back stronger.",
						date: when(retry.lockedUntil, i18n.language),
					})}
				</p>
			</Notice>
		);
	}

	// Blocked: allowance used up for good.
	if (retry.reason === "no_attempts_left") {
		return (
			<Notice tone="error" icon={AlertTriangle} className={className}>
				<p className="font-medium text-foreground">
					{t("retry.none_left_title", {
						defaultValue: "No attempts left",
					})}
				</p>
				<p className="mt-0.5 text-muted-foreground">
					{t("retry.none_left_body", {
						defaultValue:
							"You've used every attempt for this one. Reach out to your instructor if you think this is a mistake.",
					})}
				</p>
			</Notice>
		);
	}

	// Allowed, with a finite allowance — a quiet heads-up, not an alarm.
	if (retry.attemptsRemaining != null) {
		return (
			<p
				className={cn(
					"flex items-center gap-1.5 text-muted-foreground text-xs",
					className,
				)}
			>
				<RotateCcw className="size-3.5" />
				{t("retry.remaining", {
					defaultValue: "{{count}} attempt left",
					defaultValue_other: "{{count}} attempts left",
					count: retry.attemptsRemaining,
				})}
			</p>
		);
	}

	return null;
}

function Notice({
	tone,
	icon: Icon,
	className,
	children,
}: {
	tone: "warning" | "error";
	icon: typeof Clock;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<section
			role="status"
			className={cn(
				"flex items-start gap-3 rounded-card border p-4 text-sm",
				tone === "warning"
					? "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"
					: "border-error/30 bg-error/5 text-error",
				className,
			)}
		>
			<Icon className="mt-0.5 size-4 shrink-0" />
			<div className="min-w-0 flex-1">{children}</div>
		</section>
	);
}
