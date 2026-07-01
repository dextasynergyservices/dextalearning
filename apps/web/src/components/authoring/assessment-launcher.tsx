import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, ClipboardList, Loader2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	type AssessmentScope,
	createAssessment,
	listAssessments,
} from "@/lib/content-api";

type Parent = {
	courseId?: string;
	moduleId?: string;
	lessonId?: string;
	pathId?: string;
	cohortId?: string;
};

/**
 * Compact entry point to author an assessment for a given parent (course final,
 * module, lesson, …). Shows the existing assessment + its question count, or a
 * "create" button that spins one up and opens its editor.
 */
export function AssessmentLauncher({
	scope,
	parent,
	area,
	createLabel,
}: {
	scope: AssessmentScope;
	parent: Parent;
	area: "instructor" | "admin";
	createLabel?: string;
}) {
	const { t } = useTranslation("authoring");
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const queryKey = ["assessments", parent] as const;

	const { data, isPending } = useQuery({
		queryKey,
		queryFn: () => listAssessments(parent),
	});
	const list = data ?? [];
	// Match strictly by scope — a lesson can hold both a pre- and post-quiz.
	const existing = list.find((a) => a.scope === scope);

	const editRoute =
		area === "admin"
			? "/admin/assessments/$assessmentId"
			: "/instructor/assessments/$assessmentId";

	const open = (id: string) =>
		navigate({ to: editRoute, params: { assessmentId: id } });

	const create = useMutation({
		mutationFn: () => createAssessment({ scope, ...parent }),
		onSuccess: (a) => {
			queryClient.invalidateQueries({ queryKey });
			open(a.id);
		},
		onError: (e) => toast.error(e.message),
	});

	if (isPending) {
		return <div className="h-11 animate-pulse rounded-btn bg-muted" />;
	}

	if (existing) {
		return (
			<button
				type="button"
				onClick={() => open(existing.id)}
				className="flex w-full items-center gap-3 rounded-btn border border-border bg-card px-3.5 py-2.5 text-left transition-colors hover:border-brand-primary/40 hover:bg-accent"
			>
				<ClipboardList className="size-4 shrink-0 text-brand-primary" />
				<span className="min-w-0 flex-1">
					<span className="block truncate font-medium text-foreground text-sm">
						{existing.title ||
							t("assessment.untitled", { defaultValue: "Untitled assessment" })}
					</span>
					<span className="text-muted-foreground text-xs">
						{t("assessment.q_count", {
							defaultValue: "{{count}} questions · {{mark}}% to pass",
							count: existing._count?.questions ?? 0,
							mark: existing.passMark,
						})}
					</span>
				</span>
				<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
			</button>
		);
	}

	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			onClick={() => create.mutate()}
			disabled={create.isPending}
		>
			{create.isPending ? (
				<Loader2 className="size-4 animate-spin" />
			) : (
				<Plus className="size-4" />
			)}
			{createLabel ??
				t("assessment.create", { defaultValue: "Create assessment" })}
		</Button>
	);
}
