import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GroupChat } from "@/components/chat/group-chat";
import { LearnerShell } from "@/components/layout/learner-shell";

export const Route = createFileRoute("/learn/groups/$groupId")({
	component: GroupChatRoute,
});

function GroupChatRoute() {
	const { groupId } = Route.useParams();
	const { t } = useTranslation("chat");

	return (
		<LearnerShell title={t("title", { defaultValue: "Group chat" })}>
			<div className="mx-auto max-w-2xl px-4 py-4">
				<Link
					to="/learn/mine"
					className="mb-3 inline-flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
				>
					<ChevronLeft className="size-4" />
					{t("back", { defaultValue: "My learning" })}
				</Link>
				<GroupChat groupId={groupId} />
			</div>
		</LearnerShell>
	);
}
