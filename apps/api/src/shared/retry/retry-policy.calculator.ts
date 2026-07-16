/**
 * Pure retry-policy calculator (§4.4/§4.5, §6.4 rule 3). Shared by the
 * assessment-attempt and project-submission contexts so both enforce the same
 * three-knob model with identical semantics:
 *
 *   1. `maxAttempts`   — total tries allowed within a window (null = unlimited).
 *   2. `spacingHours`  — minimum wait between two consecutive tries (null = none).
 *   3. `lockoutDays`   — after a window's attempts are all used up (and none
 *                        passed), the learner is locked out for this many days;
 *                        once it elapses the window resets and they get a fresh
 *                        set of `maxAttempts` tries (null = no reset; a used-up
 *                        allowance is terminal).
 *
 * Multi-window: attempts are walked oldest→newest, opening a fresh window each
 * time a full window's lockout has elapsed. This makes the state correct even
 * across several exhaust→wait→retry cycles. No I/O, no clock except the `now`
 * passed in — trivially unit-testable.
 */

export interface RetryPolicy {
	/** Total tries per window. null = unlimited. */
	maxAttempts: number | null;
	/** Minimum hours between consecutive tries. null = none. */
	spacingHours: number | null;
	/** Post-exhaustion lockout in days before the window resets. null = none. */
	lockoutDays: number | null;
}

export interface RetryAttempt {
	submittedAt: Date;
	passed: boolean;
}

export type RetryBlockReason =
	| "already_passed"
	| "no_attempts_left"
	| "cooldown"
	| "locked_out";

export interface RetryState {
	/** Total counted attempts across all windows. */
	attemptsUsed: number;
	/** Attempts used within the current (unelapsed) window. */
	attemptsInWindow: number;
	/** Tries left in the current window. null = unlimited. */
	attemptsRemaining: number | null;
	alreadyPassed: boolean;
	canRetry: boolean;
	reason?: RetryBlockReason;
	/** When the spacing cooldown between tries ends (ISO). */
	nextAttemptAt: string | null;
	/** When the post-exhaustion lockout ends and the window resets (ISO). */
	lockedUntil: string | null;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export function computeRetryState(
	attempts: RetryAttempt[],
	policy: RetryPolicy,
	now: Date = new Date(),
): RetryState {
	const ordered = [...attempts].sort(
		(a, b) => a.submittedAt.getTime() - b.submittedAt.getTime(),
	);
	const alreadyPassed = ordered.some((a) => a.passed);
	const { maxAttempts, spacingHours, lockoutDays } = policy;

	// Walk attempts oldest→newest, resetting the window whenever a full window's
	// lockout has elapsed before the next attempt.
	let windowAttempts: Date[] = [];
	for (const a of ordered) {
		if (
			maxAttempts != null &&
			windowAttempts.length >= maxAttempts &&
			lockoutDays != null
		) {
			const lockoutEnd =
				windowAttempts[windowAttempts.length - 1].getTime() +
				lockoutDays * DAY_MS;
			if (a.submittedAt.getTime() >= lockoutEnd) windowAttempts = [];
		}
		windowAttempts.push(a.submittedAt);
	}

	const lastInWindow = windowAttempts[windowAttempts.length - 1] ?? null;
	const windowFull =
		maxAttempts != null && windowAttempts.length >= maxAttempts;

	// If the window is full but its lockout has already elapsed, the next try
	// opens a fresh window — surface that as a reset allowance, not "0 left".
	let lockedUntil: string | null = null;
	let lockoutElapsed = false;
	if (windowFull && lastInWindow) {
		if (lockoutDays == null) {
			lockedUntil = null; // terminal — no reset
		} else {
			const end = lastInWindow.getTime() + lockoutDays * DAY_MS;
			if (now.getTime() >= end) {
				lockoutElapsed = true;
			} else {
				lockedUntil = new Date(end).toISOString();
			}
		}
	}

	const effectiveWindowUsed = lockoutElapsed ? 0 : windowAttempts.length;
	const attemptsRemaining =
		maxAttempts == null ? null : Math.max(0, maxAttempts - effectiveWindowUsed);

	// Spacing cooldown between consecutive tries (skipped right after a lockout
	// reset — the lockout wait already served as the gap).
	let nextAttemptAt: string | null = null;
	if (!lockoutElapsed && spacingHours != null && lastInWindow) {
		const until = lastInWindow.getTime() + spacingHours * HOUR_MS;
		if (until > now.getTime()) nextAttemptAt = new Date(until).toISOString();
	}

	let canRetry = true;
	let reason: RetryBlockReason | undefined;
	if (alreadyPassed) {
		canRetry = false;
		reason = "already_passed";
	} else if (windowFull && !lockoutElapsed) {
		canRetry = false;
		reason = lockedUntil ? "locked_out" : "no_attempts_left";
	} else if (nextAttemptAt) {
		canRetry = false;
		reason = "cooldown";
	}

	return {
		attemptsUsed: ordered.length,
		attemptsInWindow: effectiveWindowUsed,
		attemptsRemaining,
		alreadyPassed,
		canRetry,
		reason,
		nextAttemptAt,
		lockedUntil,
	};
}
