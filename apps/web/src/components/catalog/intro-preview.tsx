import { Play, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LessonPlayer } from "@/components/player/lesson-player";
import { cn } from "@/lib/utils";

/**
 * Public "Watch intro/preview" button + modal for a path/cohort intro lesson.
 * Plays via the unauthenticated intro-media-token. Renders nothing if there's
 * no playable intro.
 */
export function IntroPreview({
	intro,
	className,
	label,
}: {
	intro: { id: string; contentType: string | null } | null;
	className?: string;
	label?: string;
}) {
	const { t } = useTranslation("academy");
	const [open, setOpen] = useState(false);

	if (!intro?.contentType) return null;

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className={cn(
					"inline-flex items-center justify-center gap-2 rounded-btn font-semibold transition-colors",
					className,
				)}
			>
				<Play className="size-4 fill-current" />
				{label ??
					t("detail.preview_watch", { defaultValue: "Watch free preview" })}
			</button>

			{open ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
					<div className="w-full max-w-3xl">
						<div className="mb-2 flex items-center justify-between">
							<span className="font-medium text-sm text-white">
								{t("detail.preview", { defaultValue: "Preview" })}
							</span>
							<button
								type="button"
								onClick={() => setOpen(false)}
								aria-label={t("detail.close", { defaultValue: "Close" })}
								className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
							>
								<X className="size-5" />
							</button>
						</div>
						<LessonPlayer lessonId={intro.id} intro />
					</div>
				</div>
			) : null}
		</>
	);
}
