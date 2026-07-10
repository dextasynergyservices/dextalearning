import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GroupBoard } from "@/components/authoring/group-board";
import { FacilitatorShell } from "@/components/layout/facilitator-shell";
import {
	facilitatorKeys,
	getMyFacilitatedCohorts,
} from "@/lib/facilitator-api";

export const Route = createFileRoute("/facilitator/cohorts/$cohortId")({
	component: FacilitatorCohortPage,
});

function FacilitatorCohortPage() {
	const { cohortId } = Route.useParams();
	const { t } = useTranslation("facilitator");
	// The portal list is cheap and usually warm — use it to title the page.
	const { data } = useQuery({
		queryKey: facilitatorKeys.cohorts,
		queryFn: getMyFacilitatedCohorts,
	});
	const cohort = data?.find((c) => c.id === cohortId);

	return (
		<FacilitatorShell
			title={cohort?.title ?? t("my_cohorts", { defaultValue: "Your cohorts" })}
		>
			<Link
				to="/facilitator"
				className="mb-4 inline-flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
			>
				<ChevronLeft className="size-4" />
				{t("back", { defaultValue: "All cohorts" })}
			</Link>
			<GroupBoard cohortId={cohortId} />
		</FacilitatorShell>
	);
}
