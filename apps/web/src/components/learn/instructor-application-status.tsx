import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "@/components/ui/button";
import { getMyProfile } from "@/lib/content-api";
import { cn } from "@/lib/utils";

/**
 * Where an instructor application stands (§8.1.1), shown on the learner
 * dashboard — the page a pending applicant actually lands on.
 *
 * Reads the profile rather than the session on purpose: an admin's approval
 * changes the database, but the applicant's existing session can still carry
 * the pre-approval snapshot, and "you're approved" is the one message that must
 * not be late. Renders nothing for people who never applied.
 */
export function InstructorApplicationStatus() {
	const { t } = useTranslation("onboarding");
	const { data } = useQuery({
		queryKey: ["my-profile"],
		queryFn: getMyProfile,
		staleTime: 60_000,
	});

	const status = data?.instructorStatus;
	if (!status) return null;
	// Once they're actually teaching the studio is in the nav; stop nagging.
	if (status === "approved" && data?.role === "instructor") {
		return null;
	}

	if (status === "pending") {
		return (
			<section className="flex items-start gap-3 rounded-card border border-brand-accent/40 bg-brand-accent-light/25 p-4">
				<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/20 text-amber-600 dark:text-amber-300">
					<Clock className="size-4" />
				</span>
				<div className="min-w-0">
					<p className="font-medium text-foreground text-sm">
						{t("applicant.status_pending_title")}
					</p>
					<p className="mt-0.5 text-muted-foreground text-sm">
						{t("applicant.status_pending_body")}
					</p>
				</div>
			</section>
		);
	}

	if (status === "approved") {
		return (
			<section className="flex flex-col gap-3 rounded-card border border-success/40 bg-success/5 p-4 sm:flex-row sm:items-center">
				<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
					<CheckCircle2 className="size-4" />
				</span>
				<div className="min-w-0 flex-1">
					<p className="font-medium text-foreground text-sm">
						{t("applicant.status_approved_title")}
					</p>
					<p className="mt-0.5 text-muted-foreground text-sm">
						{t("applicant.status_approved_body")}
					</p>
				</div>
				<Link
					to="/instructor"
					className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
				>
					{t("applicant.open_studio")}
				</Link>
			</section>
		);
	}

	// Rejected: state it once, plainly, without shaming them — they're still a
	// learner here and the rest of the dashboard is theirs.
	return (
		<section className="flex items-start gap-3 rounded-card border border-border bg-muted/40 p-4">
			<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
				<Info className="size-4" />
			</span>
			<div className="min-w-0">
				<p className="font-medium text-foreground text-sm">
					{t("applicant.status_rejected_title")}
				</p>
				<p className="mt-0.5 text-muted-foreground text-sm">
					{t("applicant.status_rejected_body")}
				</p>
			</div>
		</section>
	);
}
