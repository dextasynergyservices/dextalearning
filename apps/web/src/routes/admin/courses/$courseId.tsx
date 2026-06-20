import { createFileRoute } from "@tanstack/react-router";
import { CourseEditorPage } from "@/routes/instructor/courses/$courseId";

export const Route = createFileRoute("/admin/courses/$courseId")({
	component: AdminCourseEditorRoute,
});

function AdminCourseEditorRoute() {
	const { courseId } = Route.useParams();
	return <CourseEditorPage courseId={courseId} area="admin" />;
}
