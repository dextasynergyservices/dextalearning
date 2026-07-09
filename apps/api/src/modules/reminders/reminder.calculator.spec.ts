import { describe, expect, it } from "vitest";
import {
	advanceReview,
	DIGEST_MAX_REVIEWS,
	firstDueOn,
	isDue,
	isSendWindow,
	pickDigestReviews,
	REVIEW_INTERVALS,
	sendHourFor,
	streakLineKind,
} from "./reminder.calculator";

describe("send-hour buckets", () => {
	it("maps each study schedule to its hour, defaulting to evening", () => {
		expect(sendHourFor("morning")).toBe(8);
		expect(sendHourFor("afternoon")).toBe(13);
		expect(sendHourFor("evening")).toBe(18);
		expect(sendHourFor("weekend")).toBe(18);
		expect(sendHourFor("flexible")).toBe(18);
		expect(sendHourFor(null)).toBe(18);
		expect(sendHourFor("bogus")).toBe(18);
	});

	it("only opens the window at the exact local hour", () => {
		expect(isSendWindow("morning", 8, 2)).toBe(true);
		expect(isSendWindow("morning", 9, 2)).toBe(false);
		expect(isSendWindow(null, 18, 2)).toBe(true);
	});

	it("weekend schedule gates on Saturday/Sunday", () => {
		expect(isSendWindow("weekend", 18, 6)).toBe(true); // Saturday
		expect(isSendWindow("weekend", 18, 0)).toBe(true); // Sunday
		expect(isSendWindow("weekend", 18, 3)).toBe(false); // Wednesday
	});
});

describe("review intervals", () => {
	it("first due date is completion + 1 day", () => {
		expect(REVIEW_INTERVALS[0]).toBe(1);
		expect(firstDueOn("2026-01-10")).toBe("2026-01-11");
	});

	it("advances the full 1→3→7→14→30 ladder anchored to completion, then done", () => {
		let item = { intervalIndex: 0, completedOn: "2026-01-10" };
		const dues: string[] = [];
		let done = false;
		while (!done) {
			const next = advanceReview(item);
			done = next.done;
			if (!done) dues.push(next.nextDueOn);
			item = { ...item, intervalIndex: next.intervalIndex };
		}
		expect(dues).toEqual([
			"2026-01-13", // +3
			"2026-01-17", // +7
			"2026-01-24", // +14
			"2026-02-09", // +30
		]);
	});

	it("isDue treats today and overdue as due", () => {
		expect(isDue("2026-01-11", "2026-01-11")).toBe(true);
		expect(isDue("2026-01-05", "2026-01-11")).toBe(true);
		expect(isDue("2026-01-12", "2026-01-11")).toBe(false);
	});
});

describe("digest composition", () => {
	it("caps at the digest max, oldest due first", () => {
		const due = [
			{ nextDueOn: "2026-01-10", id: "c" },
			{ nextDueOn: "2026-01-08", id: "a" },
			{ nextDueOn: "2026-01-11", id: "d" },
			{ nextDueOn: "2026-01-09", id: "b" },
		];
		const picked = pickDigestReviews(due);
		expect(picked).toHaveLength(DIGEST_MAX_REVIEWS);
		expect(picked.map((p) => p.id)).toEqual(["a", "b", "c"]);
	});
});

describe("streakLineKind (§3.2 loss aversion vs §3.1 fresh start)", () => {
	const today = "2026-07-10";

	it("idle since yesterday → at_risk (loss-aversion framing)", () => {
		expect(streakLineKind("2026-07-09", today, 5)).toBe("at_risk");
	});

	it("broken (idle ≥ 2 days) with a real streak → fresh_start", () => {
		expect(streakLineKind("2026-07-08", today, 5)).toBe("fresh_start");
		expect(streakLineKind("2026-07-01", today, 12)).toBe("fresh_start");
	});

	it("a trivial broken streak gets no line — nothing worth restarting", () => {
		expect(streakLineKind("2026-07-08", today, 2)).toBeNull();
	});

	it("active today or no streak at all → no line", () => {
		expect(streakLineKind(today, today, 5)).toBeNull();
		expect(streakLineKind(null, today, 5)).toBeNull();
		expect(streakLineKind("2026-07-09", today, 0)).toBeNull();
	});
});
