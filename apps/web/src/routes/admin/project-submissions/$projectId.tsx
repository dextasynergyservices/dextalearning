import { createFileRoute } from "@tanstack/react-router";
import { SubmissionsQueuePage } from "@/routes/instructor/project-submissions/$projectId";

export const Route = createFileRoute("/admin/project-submissions/$projectId")({
	component: AdminSubmissionsRoute,
});

function AdminSubmissionsRoute() {
	const { projectId } = Route.useParams();
	return <SubmissionsQueuePage projectId={projectId} area="admin" />;
}
