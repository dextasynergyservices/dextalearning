import { createFileRoute } from "@tanstack/react-router";
import { ProjectEditorPage } from "@/routes/instructor/projects/$projectId";

export const Route = createFileRoute("/admin/projects/$projectId")({
	component: AdminProjectRoute,
});

function AdminProjectRoute() {
	const { projectId } = Route.useParams();
	return <ProjectEditorPage projectId={projectId} area="admin" />;
}
