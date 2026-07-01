/**
 * Content-length helpers (§4.3). "Content length" is the *calculated* sum of
 * lesson media durations — distinct from the free-text `estimatedDuration` an
 * author types (e.g. "6–8 weeks"). Text/PDF lessons carry no media duration, so
 * a module of only those reads as 0 minutes and the chip is hidden.
 */
interface TimedLesson {
	videoDurationSec: number | null;
	audioDurationSec: number | null;
}

export function lessonSeconds(lesson: TimedLesson): number {
	return lesson.videoDurationSec ?? lesson.audioDurationSec ?? 0;
}

/** Total content minutes from lesson media durations (0 when none are timed). */
export function contentMinutes(lessons: TimedLesson[]): number {
	const seconds = lessons.reduce((total, l) => total + lessonSeconds(l), 0);
	return seconds > 0 ? Math.ceil(seconds / 60) : 0;
}

/** Localized "≈ 35 min" / "≈ 2h 15m" label; empty string when there's no media. */
export function contentLengthLabel(
	t: (key: string, opts?: Record<string, unknown>) => string,
	minutes: number,
): string {
	if (minutes <= 0) return "";
	if (minutes < 60)
		return t("content.minutes", {
			count: minutes,
			defaultValue: "≈ {{count}} min",
		});
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m === 0
		? t("content.hours", { count: h, defaultValue: "≈ {{count}}h" })
		: t("content.hours_minutes", { h, m, defaultValue: "≈ {{h}}h {{m}}m" });
}
