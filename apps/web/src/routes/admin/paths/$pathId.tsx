import { createFileRoute } from "@tanstack/react-router";
import { PathEditorPage } from "@/routes/instructor/paths/$pathId";

export const Route = createFileRoute("/admin/paths/$pathId")({
	component: AdminPathEditorRoute,
});

function AdminPathEditorRoute() {
	const { pathId } = Route.useParams();
	return <PathEditorPage pathId={pathId} area="admin" />;
}
