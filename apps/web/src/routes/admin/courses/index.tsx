import { createFileRoute } from "@tanstack/react-router";
import { CoursesPage } from "@/routes/instructor/courses";

export const Route = createFileRoute("/admin/courses/")({
	component: AdminCoursesRoute,
});

function AdminCoursesRoute() {
	return <CoursesPage area="admin" />;
}
