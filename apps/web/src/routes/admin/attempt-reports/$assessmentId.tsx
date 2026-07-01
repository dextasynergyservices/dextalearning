import { createFileRoute } from "@tanstack/react-router";
import { AttemptsReportPage } from "@/routes/instructor/attempt-reports/$assessmentId";

export const Route = createFileRoute("/admin/attempt-reports/$assessmentId")({
	component: AdminAttemptReportsRoute,
});

function AdminAttemptReportsRoute() {
	const { assessmentId } = Route.useParams();
	return <AttemptsReportPage assessmentId={assessmentId} area="admin" />;
}
