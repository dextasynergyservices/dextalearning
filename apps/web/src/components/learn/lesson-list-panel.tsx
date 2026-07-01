import { CheckCircle2, FileText, Headphones, Play } from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import type { LessonContextItem } from "@/lib/content-api";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<string, ComponentType<{ className?: string }>> = {
	video: Play,
	audio: Headphones,
	text: FileText,
	pdf: FileText,
};

/**
 * The course's full lesson list shown alongside the player (§8.2) — module
 * grouped, with completion ticks, the active lesson highlighted, and tap-to-jump
 * so finished lessons stay reachable. Used as a desktop side panel and inside
 * the mobile bottom sheet.
 */
export function LessonListPanel({
	lessons,
	currentId,
	doneCount,
	onSelect,
	bare = false,
}: {
	lessons: LessonContextItem[];
	currentId: string;
	doneCount: number;
	onSelect: (id: string) => void;
	/** Drop the outer card chrome (used inside the mobile bottom sheet). */
	bare?: boolean;
}) {
	const { t } = useTranslation("authoring");

	// Group consecutive lessons by module, preserving order.
	const groups: { title: string; items: LessonContextItem[] }[] = [];
	for (const lesson of lessons) {
		const last = groups.at(-1);
		if (last && last.title === lesson.moduleTitle) last.items.push(lesson);
		else groups.push({ title: lesson.moduleTitle, items: [lesson] });
	}

	return (
		<div
			className={cn(
				"overflow-hidden bg-card",
				!bare && "rounded-card border border-border shadow-card",
			)}
		>
			<div className="border-border border-b px-4 py-3">
				<p className="font-display text-foreground">
					{t("play.lessons", { defaultValue: "Lessons" })}
				</p>
				<p className="mt-0.5 font-stats text-muted-foreground text-xs">
					{t("play.lessons_done", {
						defaultValue: "{{done}} of {{total}} complete",
						done: doneCount,
						total: lessons.length,
					})}
				</p>
			</div>
			<div className="max-h-[70dvh] overflow-y-auto py-1">
				{groups.map((group) => (
					<div key={group.items[0].id} className="py-1">
						{group.title ? (
							<p className="px-4 pt-2 pb-1 font-stats font-semibold text-[0.68rem] text-muted-foreground uppercase tracking-wide">
								{group.title}
							</p>
						) : null}
						{group.items.map((lesson) => {
							const active = lesson.id === currentId;
							const Icon = TYPE_ICON[lesson.contentType ?? ""] ?? FileText;
							return (
								<button
									key={lesson.id}
									type="button"
									onClick={() => onSelect(lesson.id)}
									aria-current={active ? "true" : undefined}
									className={cn(
										"flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
										active
											? "bg-brand-primary-light text-brand-primary"
											: "text-foreground hover:bg-accent",
									)}
								>
									<span className="shrink-0">
										{lesson.done ? (
											<CheckCircle2 className="size-4 text-success" />
										) : (
											<Icon
												className={cn(
													"size-4",
													active
														? "text-brand-primary"
														: "text-muted-foreground",
												)}
											/>
										)}
									</span>
									<span
										className={cn(
											"min-w-0 flex-1 truncate text-sm",
											active && "font-medium",
										)}
									>
										{lesson.title}
									</span>
								</button>
							);
						})}
					</div>
				))}
			</div>
		</div>
	);
}
