import { createFileRoute } from "@tanstack/react-router";
import { AssessmentEditorPage } from "@/routes/instructor/assessments/$assessmentId";

export const Route = createFileRoute("/admin/assessments/$assessmentId")({
	component: AdminAssessmentRoute,
});

function AdminAssessmentRoute() {
	const { assessmentId } = Route.useParams();
	return <AssessmentEditorPage assessmentId={assessmentId} area="admin" />;
}
