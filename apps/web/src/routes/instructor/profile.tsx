import { createFileRoute } from "@tanstack/react-router";
import { ProfileEditor } from "@/components/authoring/profile-editor";

export const Route = createFileRoute("/instructor/profile")({
	component: () => <ProfileEditor area="instructor" />,
});
