import { createFileRoute } from "@tanstack/react-router";
import { LessonEditorPage } from "@/routes/instructor/lessons/$lessonId";

export const Route = createFileRoute("/admin/lessons/$lessonId")({
	component: AdminLessonEditorRoute,
});

function AdminLessonEditorRoute() {
	const { lessonId } = Route.useParams();
	return <LessonEditorPage lessonId={lessonId} area="admin" />;
}
