import { describe, expect, it } from "vitest";
import {
	computeRetryState,
	type RetryAttempt,
	type RetryPolicy,
} from "./retry-policy.calculator";

const H = 3_600_000;
const D = 86_400_000;
const NOW = new Date("2026-07-14T12:00:00.000Z");

function at(msAgo: number): Date {
	return new Date(NOW.getTime() - msAgo);
}

function fail(msAgo: number): RetryAttempt {
	return { submittedAt: at(msAgo), passed: false };
}

const unlimited: RetryPolicy = {
	maxAttempts: null,
	spacingHours: null,
	lockoutDays: null,
};

describe("computeRetryState", () => {
	it("allows the first attempt when nothing has been tried", () => {
		const s = computeRetryState([], unlimited, NOW);
		expect(s.canRetry).toBe(true);
		expect(s.attemptsUsed).toBe(0);
		expect(s.attemptsRemaining).toBeNull();
	});

	it("blocks once passed, regardless of remaining attempts", () => {
		const s = computeRetryState(
			[{ submittedAt: at(D), passed: true }],
			{ maxAttempts: 3, spacingHours: null, lockoutDays: null },
			NOW,
		);
		expect(s.canRetry).toBe(false);
		expect(s.reason).toBe("already_passed");
		expect(s.alreadyPassed).toBe(true);
	});

	it("counts attempts and reports remaining within maxAttempts", () => {
		const s = computeRetryState(
			[fail(3 * D), fail(2 * D)],
			{ maxAttempts: 3, spacingHours: null, lockoutDays: null },
			NOW,
		);
		expect(s.attemptsInWindow).toBe(2);
		expect(s.attemptsRemaining).toBe(1);
		expect(s.canRetry).toBe(true);
	});

	it("blocks with no_attempts_left when the window is full and no lockout reset is set", () => {
		const s = computeRetryState(
			[fail(3 * D), fail(2 * D), fail(D)],
			{ maxAttempts: 3, spacingHours: null, lockoutDays: null },
			NOW,
		);
		expect(s.canRetry).toBe(false);
		expect(s.reason).toBe("no_attempts_left");
		expect(s.attemptsRemaining).toBe(0);
		expect(s.lockedUntil).toBeNull();
	});

	it("enforces spacing between consecutive tries", () => {
		const s = computeRetryState(
			[fail(2 * H)], // last try 2h ago
			{ maxAttempts: 3, spacingHours: 6, lockoutDays: null },
			NOW,
		);
		expect(s.canRetry).toBe(false);
		expect(s.reason).toBe("cooldown");
		expect(s.nextAttemptAt).toBe(
			new Date(at(2 * H).getTime() + 6 * H).toISOString(),
		);
	});

	it("allows the next try once spacing has elapsed", () => {
		const s = computeRetryState(
			[fail(7 * H)],
			{ maxAttempts: 3, spacingHours: 6, lockoutDays: null },
			NOW,
		);
		expect(s.canRetry).toBe(true);
		expect(s.nextAttemptAt).toBeNull();
	});

	it("locks out for lockoutDays after the window is exhausted", () => {
		const s = computeRetryState(
			[fail(3 * D), fail(2 * D), fail(1 * D)], // exhausted 1 day ago
			{ maxAttempts: 3, spacingHours: null, lockoutDays: 7 },
			NOW,
		);
		expect(s.canRetry).toBe(false);
		expect(s.reason).toBe("locked_out");
		expect(s.lockedUntil).toBe(new Date(at(D).getTime() + 7 * D).toISOString());
		expect(s.attemptsRemaining).toBe(0);
	});

	it("resets the window with a fresh allowance once the lockout elapses", () => {
		// 3 failures, last was 8 days ago; 7-day lockout has passed.
		const s = computeRetryState(
			[fail(10 * D), fail(9 * D), fail(8 * D)],
			{ maxAttempts: 3, spacingHours: null, lockoutDays: 7 },
			NOW,
		);
		expect(s.canRetry).toBe(true);
		expect(s.reason).toBeUndefined();
		expect(s.attemptsInWindow).toBe(0);
		expect(s.attemptsRemaining).toBe(3);
		expect(s.attemptsUsed).toBe(3); // history is preserved
	});

	it("counts a fresh window's attempts after a prior lockout reset", () => {
		// window 1: 3 fails ending 20 days ago (7-day lockout long elapsed)
		// window 2: 1 fail 1 day ago
		const s = computeRetryState(
			[fail(22 * D), fail(21 * D), fail(20 * D), fail(1 * D)],
			{ maxAttempts: 3, spacingHours: null, lockoutDays: 7 },
			NOW,
		);
		expect(s.attemptsInWindow).toBe(1);
		expect(s.attemptsRemaining).toBe(2);
		expect(s.canRetry).toBe(true);
	});
});
