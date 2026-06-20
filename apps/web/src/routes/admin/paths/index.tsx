import { createFileRoute } from "@tanstack/react-router";
import { PathsPage } from "@/routes/instructor/paths";

export const Route = createFileRoute("/admin/paths/")({
	component: AdminPathsRoute,
});

function AdminPathsRoute() {
	return <PathsPage area="admin" />;
}
