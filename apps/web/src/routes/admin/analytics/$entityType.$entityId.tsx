import { createFileRoute } from "@tanstack/react-router";
import { EntityAnalyticsDetailPage } from "@/routes/instructor/analytics/$entityType.$entityId";

export const Route = createFileRoute("/admin/analytics/$entityType/$entityId")({
	component: () => <EntityAnalyticsDetailPage area="admin" />,
});
