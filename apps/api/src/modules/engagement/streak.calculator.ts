/**
 * Pure streak math (§3.2 "streaks create loss aversion"; §6.4 pure
 * calculators — no Prisma, no NestJS, no I/O). All dates are user-LOCAL
 * calendar days as "YYYY-MM-DD" strings; conversion from an instant happens
 * once at the edge via `localDateOf`, and day arithmetic is done on the date
 * strings with `Date.UTC` so DST shifts can never produce off-by-one days.
 */

export const DEFAULT_TIMEZONE = "Africa/Lagos";
/** A learner can bank at most this many streak freezes. */
export const MAX_FREEZES = 2;
/** A freeze is earned every time the streak reaches a multiple of this. */
export const FREEZE_MILESTONE = 7;

/** `user.timezone` is free text — fall back rather than crash on junk. */
export function resolveTimezone(timezone: string | null | undefined): string {
	if (!timezone) return DEFAULT_TIMEZONE;
	try {
		new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
		return timezone;
	} catch {
		return DEFAULT_TIMEZONE;
	}
}

/** The user-local calendar date ("YYYY-MM-DD") of an instant. */
export function localDateOf(
	instant: Date,
	timezone: string | null | undefined,
): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: resolveTimezone(timezone),
	}).format(instant);
}

/** The user-local hour (0–23) of an instant. */
export function localHourOf(
	instant: Date,
	timezone: string | null | undefined,
): number {
	return Number(
		new Intl.DateTimeFormat("en-GB", {
			timeZone: resolveTimezone(timezone),
			hour: "2-digit",
			hour12: false,
		}).format(instant),
	);
}

/** The user-local day of week (0=Sunday … 6=Saturday) of an instant. */
export function localDayOfWeekOf(
	instant: Date,
	timezone: string | null | undefined,
): number {
	const name = new Intl.DateTimeFormat("en-US", {
		timeZone: resolveTimezone(timezone),
		weekday: "short",
	}).format(instant);
	return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

function toUtcMs(date: string): number {
	const [y, m, d] = date.split("-").map(Number);
	return Date.UTC(y, m - 1, d);
}

/** Whole days from `fromDate` to `toDate` (date-only, DST-immune). */
export function diffDays(fromDate: string, toDate: string): number {
	return Math.round((toUtcMs(toDate) - toUtcMs(fromDate)) / 86_400_000);
}

/** The calendar day before a local date. */
export function dayBefore(date: string): string {
	return new Date(toUtcMs(date) - 86_400_000).toISOString().slice(0, 10);
}

/** Add whole days to a local date. */
export function addDays(date: string, days: number): string {
	return new Date(toUtcMs(date) + days * 86_400_000).toISOString().slice(0, 10);
}

export interface StreakState {
	current: number;
	longest: number;
	freezes: number;
	/** Local date of the last qualifying activity, or null before any. */
	lastActiveDate: string | null;
}

export interface StreakUpdate extends StreakState {
	/** False when the activity was a same-day (or clock-skew) no-op. */
	changed: boolean;
	/** Freezes auto-consumed to bridge missed days on this update. */
	freezesConsumed: number;
	/** Set when this update crossed a freeze-earning milestone. */
	milestoneReached: number | null;
}

/**
 * Applies one qualifying learning activity on `localToday`:
 *  - first ever activity → streak of 1
 *  - same local day → no-op (idempotent per day)
 *  - `localToday` BEFORE `lastActiveDate` (westward tz change / clock skew)
 *    → no-op; a streak never regresses
 *  - consecutive day → +1
 *  - missed day(s) fully bridged by banked freezes → +1, freezes consumed
 *  - missed day(s) beyond freezes → reset to 1; freezes are RETAINED
 *    (partial bridges are never spent on an already-broken streak)
 * After any increment: `longest` tracks the max, and reaching a multiple of
 * `FREEZE_MILESTONE` banks one freeze (capped at `MAX_FREEZES`).
 */
export function applyActivity(
	state: StreakState,
	localToday: string,
): StreakUpdate {
	const noop: StreakUpdate = {
		...state,
		changed: false,
		freezesConsumed: 0,
		milestoneReached: null,
	};
	if (state.lastActiveDate === localToday) return noop;
	if (state.lastActiveDate && diffDays(state.lastActiveDate, localToday) < 0) {
		return noop;
	}

	let current: number;
	let freezes = state.freezes;
	let freezesConsumed = 0;

	if (!state.lastActiveDate) {
		current = 1;
	} else {
		const gap = diffDays(state.lastActiveDate, localToday) - 1;
		if (gap === 0) {
			current = state.current + 1;
		} else if (freezes >= gap) {
			current = state.current + 1;
			freezes -= gap;
			freezesConsumed = gap;
		} else {
			current = 1;
		}
	}

	let milestoneReached: number | null = null;
	if (current > 0 && current % FREEZE_MILESTONE === 0) {
		milestoneReached = current;
		freezes = Math.min(MAX_FREEZES, freezes + 1);
	}

	return {
		current,
		longest: Math.max(state.longest, current),
		freezes,
		lastActiveDate: localToday,
		changed: true,
		freezesConsumed,
		milestoneReached,
	};
}

/** A live streak is at risk when the last activity was exactly yesterday. */
export function isAtRisk(
	lastActiveDate: string | null,
	localToday: string,
): boolean {
	return lastActiveDate != null && lastActiveDate === dayBefore(localToday);
}
