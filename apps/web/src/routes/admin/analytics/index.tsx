import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsOverviewPage } from "@/routes/instructor/analytics/index";

export const Route = createFileRoute("/admin/analytics/")({
	component: () => <AnalyticsOverviewPage area="admin" />,
});
