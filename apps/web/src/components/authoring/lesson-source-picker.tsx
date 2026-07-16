import { Check, Minus } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { AssessmentSourceLesson } from "@/lib/content-api";
import { cn } from "@/lib/utils";

interface Group {
	key: string;
	courseTitle: string | null;
	moduleTitle: string | null;
	lessons: AssessmentSourceLesson[];
}

/** Group by course → module, preserving the server's curriculum ordering. */
function groupLessons(lessons: AssessmentSourceLesson[]): Group[] {
	const groups: Group[] = [];
	for (const lesson of lessons) {
		const key = `${lesson.courseId ?? "?"}:${lesson.moduleId ?? "?"}`;
		const last = groups[groups.length - 1];
		if (last?.key === key) {
			last.lessons.push(lesson);
		} else {
			groups.push({
				key,
				courseTitle: lesson.courseTitle,
				moduleTitle: lesson.moduleTitle,
				lessons: [lesson],
			});
		}
	}
	return groups;
}

/**
 * Multi-select over the lessons an assessment may draw questions from (§4.4),
 * grouped by course → module so a whole module (or, for a path/cohort final, a
 * whole course) can be ticked at once. Lessons with no usable source are shown
 * but disabled — the instructor should see *why* a lesson isn't offered rather
 * than wonder where it went.
 */
export function LessonSourcePicker({
	lessons,
	selected,
	onChange,
}: {
	lessons: AssessmentSourceLesson[];
	selected: string[];
	onChange: (ids: string[]) => void;
}) {
	const { t } = useTranslation("authoring");
	const groups = useMemo(() => groupLessons(lessons), [lessons]);
	const selectable = useMemo(
		() => lessons.filter((l) => l.hasTranscript).map((l) => l.id),
		[lessons],
	);
	const chosen = useMemo(() => new Set(selected), [selected]);
	// A path/cohort final spans several courses — only then is the course name
	// worth the extra line.
	const multiCourse = new Set(lessons.map((l) => l.courseId)).size > 1;

	const toggle = (id: string) =>
		onChange(
			chosen.has(id) ? selected.filter((x) => x !== id) : [...selected, id],
		);

	const toggleGroup = (group: Group) => {
		const ids = group.lessons.filter((l) => l.hasTranscript).map((l) => l.id);
		const allOn = ids.every((id) => chosen.has(id));
		onChange(
			allOn
				? selected.filter((id) => !ids.includes(id))
				: [...new Set([...selected, ...ids])],
		);
	};

	return (
		<div>
			<div className="mb-1.5 flex items-center justify-between gap-2">
				<span className="font-medium text-foreground text-sm">
					{t("assessment.ai_sources", { defaultValue: "Generate from" })}
				</span>
				<div className="flex items-center gap-2 text-xs">
					<button
						type="button"
						onClick={() => onChange(selectable)}
						disabled={selectable.length === 0}
						className="text-brand-primary transition-colors hover:underline disabled:opacity-40"
					>
						{t("assessment.ai_select_all", { defaultValue: "Select all" })}
					</button>
					<span className="text-muted-foreground">·</span>
					<button
						type="button"
						onClick={() => onChange([])}
						disabled={selected.length === 0}
						className="text-muted-foreground transition-colors hover:underline disabled:opacity-40"
					>
						{t("assessment.ai_clear", { defaultValue: "Clear" })}
					</button>
				</div>
			</div>

			<div className="max-h-64 overflow-y-auto overscroll-contain rounded-card border border-border">
				{groups.map((group) => {
					const ids = group.lessons
						.filter((l) => l.hasTranscript)
						.map((l) => l.id);
					const on = ids.length > 0 && ids.every((id) => chosen.has(id));
					const some = !on && ids.some((id) => chosen.has(id));
					return (
						<section key={group.key}>
							<button
								type="button"
								onClick={() => toggleGroup(group)}
								disabled={ids.length === 0}
								className="flex w-full items-center gap-2.5 border-border border-b bg-muted/60 px-3 py-2 text-left transition-colors hover:bg-muted disabled:opacity-60"
							>
								<Box checked={on} partial={some} />
								<span className="min-w-0 flex-1">
									<span className="block truncate font-medium text-foreground text-xs">
										{group.moduleTitle ??
											t("assessment.ai_ungrouped", {
												defaultValue: "Lessons",
											})}
									</span>
									{multiCourse && group.courseTitle ? (
										<span className="block truncate text-[0.65rem] text-muted-foreground">
											{group.courseTitle}
										</span>
									) : null}
								</span>
							</button>
							<ul>
								{group.lessons.map((lesson) => (
									<li key={lesson.id}>
										<button
											type="button"
											onClick={() => toggle(lesson.id)}
											disabled={!lesson.hasTranscript}
											className="flex w-full items-center gap-2.5 border-border/60 border-b px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-accent disabled:cursor-not-allowed disabled:hover:bg-transparent"
										>
											<Box checked={chosen.has(lesson.id)} />
											<span
												className={cn(
													"min-w-0 flex-1 truncate text-sm",
													lesson.hasTranscript
														? "text-foreground"
														: "text-muted-foreground",
												)}
											>
												{lesson.title}
											</span>
											{!lesson.hasTranscript ? (
												<span className="shrink-0 text-[0.65rem] text-muted-foreground">
													{t("assessment.ai_no_transcript", {
														defaultValue: "no transcript",
													})}
												</span>
											) : null}
										</button>
									</li>
								))}
							</ul>
						</section>
					);
				})}
			</div>

			<p className="mt-1.5 text-muted-foreground text-xs">
				{t("assessment.ai_selected_count", {
					defaultValue_one: "{{count}} lesson selected",
					defaultValue_other: "{{count}} lessons selected",
					count: selected.length,
				})}
			</p>
		</div>
	);
}

function Box({ checked, partial }: { checked: boolean; partial?: boolean }) {
	return (
		<span
			aria-hidden
			className={cn(
				"flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
				checked || partial
					? "border-brand-primary bg-brand-primary text-white"
					: "border-border",
			)}
		>
			{checked ? (
				<Check className="size-3" strokeWidth={3} />
			) : partial ? (
				<Minus className="size-3" strokeWidth={3} />
			) : null}
		</span>
	);
}
