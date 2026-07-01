import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import {
	type CohortProgress,
	type CourseProgress,
	type EnrollableType,
	enroll,
	getCohortProgress,
	getCourseProgress,
	getEnrollmentStatus,
	getPathProgress,
	type PathProgress,
} from "@/lib/content-api";
import { cn } from "@/lib/utils";

// Explicit return type: without it, TS infers `Promise<A> | Promise<B> | Promise<C>`
// (a union of promises) instead of `Promise<A | B | C>`, which the `useQuery`
// overloads below can't resolve to a single matching signature.
function progressOf(
	type: EnrollableType,
	id: string,
): Promise<CourseProgress | PathProgress | CohortProgress> {
	if (type === "course") return getCourseProgress(id);
	if (type === "path") return getPathProgress(id);
	return getCohortProgress(id);
}

/**
 * The single source of truth for a detail page's primary CTA. Enrolment gates
 * everything (even free): signed-out → "Enroll to start"; signed-in but not
 * enrolled → "Enroll"; enrolled with no progress → "Start learning"; with
 * progress → "Continue learning". Query keys are scoped by user id so one
 * learner never sees another's cached progress.
 */
export function EnrollCta({
	type,
	id,
	size = "lg",
	className,
}: {
	type: EnrollableType;
	id: string;
	size?: "lg" | "sm";
	className?: string;
}) {
	const { t } = useTranslation("academy");
	const qc = useQueryClient();
	const location = useLocation();
	const { data: session } = useSession();
	const userId = session?.user?.id;
	const isLearner = Boolean(userId);

	const { data: status } = useQuery({
		queryKey: ["enrollment", type, id, userId],
		queryFn: () => getEnrollmentStatus(type, id),
		enabled: isLearner,
	});
	const { data: progress } = useQuery({
		queryKey: ["progress", type, id, userId],
		queryFn: () => progressOf(type, id),
		enabled: isLearner,
	});

	const started = (progress?.summary.percent ?? 0) > 0;
	const enrolled = Boolean(status?.enrolled) || started;

	const enrollMutation = useMutation({
		mutationFn: () => enroll(type, id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["enrollment", type, id, userId] });
			qc.invalidateQueries({ queryKey: ["my-learning", userId] });
			qc.invalidateQueries({ queryKey: ["my-learning"] });
			toast.success(t("detail.enrolled", { defaultValue: "You're enrolled!" }));
		},
		onError: (e) => toast.error(e.message),
	});

	const cls = cn(
		buttonVariants({ variant: "primary", size: size === "sm" ? "md" : "lg" }),
		size === "lg" ? "w-full" : "shrink-0",
		size === "sm" && "h-10",
		className,
	);

	if (!isLearner) {
		// Send them to sign in, then straight back here to finish enrolling.
		return (
			<Link to="/login" search={{ redirect: location.href }} className={cls}>
				{t("detail.enroll_to_start", { defaultValue: "Enroll to start" })}
			</Link>
		);
	}

	if (!enrolled) {
		return (
			<button
				type="button"
				onClick={() => enrollMutation.mutate()}
				disabled={enrollMutation.isPending}
				className={cls}
			>
				{enrollMutation.isPending ? (
					<Loader2 className="size-4 animate-spin" />
				) : null}
				{t("detail.enroll", { defaultValue: "Enroll" })}
			</button>
		);
	}

	const label = started
		? t("detail.continue_learning", { defaultValue: "Continue learning" })
		: t("detail.start_learning", { defaultValue: "Start learning" });

	if (type === "course") {
		return (
			<Link
				to="/learn/course/$courseId"
				params={{ courseId: id }}
				className={cls}
			>
				{label}
			</Link>
		);
	}
	if (type === "path") {
		return (
			<Link to="/learn/path/$pathId" params={{ pathId: id }} className={cls}>
				{label}
			</Link>
		);
	}
	return (
		<Link
			to="/learn/cohort/$cohortId"
			params={{ cohortId: id }}
			className={cls}
		>
			{label}
		</Link>
	);
}
