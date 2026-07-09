/**
 * Pure spaced-repetition + scheduling math (§3.1 Ebbinghaus/Cepeda; §6.4
 * pure calculators). Owns: the expanding review-interval ladder, the
 * study-schedule → send-hour buckets (§3.2 implementation intentions — the
 * learner told us WHEN they study, so that's when we nudge), and digest
 * composition rules. No Prisma, no I/O.
 */
import { addDays, diffDays } from "../engagement/streak.calculator";

/** Expanding revisit intervals, in days after completion (§3.1). */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const;

/** At most this many review items are named in one digest. */
export const DIGEST_MAX_REVIEWS = 3;

/**
 * The user-local hour a digest is sent, by onboarding `studySchedule`.
 * `weekend` only sends on Saturday/Sunday; anything unknown → evening.
 */
export function sendHourFor(studySchedule: string | null | undefined): number {
	switch (studySchedule) {
		case "morning":
			return 8;
		case "afternoon":
			return 13;
		default:
			return 18; // evening | weekend | flexible | null
	}
}

/** Whether a digest may go out at this user-local moment. */
export function isSendWindow(
	studySchedule: string | null | undefined,
	localHour: number,
	localDayOfWeek: number,
): boolean {
	if (localHour !== sendHourFor(studySchedule)) return false;
	if (studySchedule === "weekend") {
		return localDayOfWeek === 0 || localDayOfWeek === 6;
	}
	return true;
}

export interface ReviewItemState {
	intervalIndex: number;
	completedOn: string;
}

/**
 * Advances a review item after it was included in a digest: next rung of the
 * ladder, or done past the last one. `nextDueOn` is always anchored to the
 * ORIGINAL completion date (true spaced repetition, not send-date drift).
 */
export function advanceReview(item: ReviewItemState): {
	intervalIndex: number;
	nextDueOn: string;
	done: boolean;
} {
	const nextIndex = item.intervalIndex + 1;
	if (nextIndex >= REVIEW_INTERVALS.length) {
		return {
			intervalIndex: nextIndex,
			nextDueOn: item.completedOn,
			done: true,
		};
	}
	return {
		intervalIndex: nextIndex,
		nextDueOn: addDays(item.completedOn, REVIEW_INTERVALS[nextIndex]),
		done: false,
	};
}

/** The first due date for a lesson completed on `completedOn`. */
export function firstDueOn(completedOn: string): string {
	return addDays(completedOn, REVIEW_INTERVALS[0]);
}

/** Local-date dueness: due today or overdue. */
export function isDue(nextDueOn: string, localToday: string): boolean {
	return nextDueOn <= localToday;
}

/** Oldest-due-first, capped for the digest; the rest roll to tomorrow. */
export function pickDigestReviews<T extends { nextDueOn: string }>(
	due: T[],
): T[] {
	return [...due]
		.sort((a, b) => a.nextDueOn.localeCompare(b.nextDueOn))
		.slice(0, DIGEST_MAX_REVIEWS);
}

/** A streak only counts as "worth restarting" from this length. */
export const FRESH_START_MIN_STREAK = 3;

export type StreakLineKind = "at_risk" | "fresh_start" | null;

/**
 * Which streak framing a digest gets (§3.2 loss aversion vs §3.1 fresh
 * start, Dai/Milkman/Riis 2014): a streak still alive but idle since
 * YESTERDAY gets the loss-aversion line; a streak that already broke (idle
 * ≥ 2 days) gets the fresh-start reframe instead of having the loss rubbed
 * in — and only when it was a real streak worth restarting. Anything else
 * (active today, no streak) gets no streak line at all.
 */
export function streakLineKind(
	lastActiveDate: string | null,
	localToday: string,
	current: number,
): StreakLineKind {
	if (!lastActiveDate || current <= 0) return null;
	const idleDays = diffDays(lastActiveDate, localToday);
	if (idleDays === 1) return "at_risk";
	if (idleDays >= 2 && current >= FRESH_START_MIN_STREAK) return "fresh_start";
	return null;
}
