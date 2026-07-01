import { useMutation } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	type CourseSummary,
	createCourse,
	createPath,
	type PathSummary,
} from "@/lib/content-api";

/**
 * Inline "create a new draft + attach it" for the path/cohort builders, so you
 * don't have to leave the builder when the course/path you want doesn't exist
 * yet. Creates a bare draft (title only) and hands its id back to the caller,
 * which attaches it; the draft is fleshed out later in its own editor.
 */
export function InlineCreate({
	kind,
	onCreated,
	attaching,
}: {
	kind: "course" | "path";
	onCreated: (id: string) => void;
	attaching?: boolean;
}) {
	const { t } = useTranslation("authoring");
	const [title, setTitle] = useState("");

	// Explicit type argument: the ternary returns `Promise<CourseSummary> |
	// Promise<PathSummary>`, which useMutation's inference can't collapse into
	// a single TData on its own.
	const create = useMutation<CourseSummary | PathSummary, Error, void>({
		mutationFn: () =>
			kind === "course"
				? createCourse({ title: title.trim() })
				: createPath({ title: title.trim() }),
		onSuccess: (created) => {
			setTitle("");
			onCreated(created.id);
		},
		onError: (e) => toast.error(e.message),
	});

	const busy = create.isPending || Boolean(attaching);
	const placeholder =
		kind === "course"
			? t("paths.new_course_title", { defaultValue: "New course title…" })
			: t("paths.new_path_title", { defaultValue: "New path title…" });

	return (
		<div className="flex flex-col gap-2 sm:flex-row">
			<input
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && title.trim() && !busy) create.mutate();
				}}
				placeholder={placeholder}
				maxLength={200}
				className="h-11 flex-1 rounded-input border border-border bg-card px-3 text-foreground text-sm outline-none focus:border-brand-primary"
			/>
			<Button
				variant="outline"
				disabled={!title.trim() || busy}
				onClick={() => create.mutate()}
			>
				{busy ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<Plus className="size-4" />
				)}
				{t("paths.create_add", { defaultValue: "Create & add" })}
			</Button>
		</div>
	);
}
