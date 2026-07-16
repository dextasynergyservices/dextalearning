import { describe, expect, it } from "vitest";
import {
	canLearnerSetDeadline,
	type DeadlineOrderView,
	deadlineFrom,
	rejectDeadlineCommit,
} from "./earn-back-deadline.calculator";

function order(overrides: Partial<DeadlineOrderView> = {}): DeadlineOrderView {
	return {
		isEarnBackEligible: true,
		status: "paid",
		earnBackDeadlineDays: 60,
		earnBackDeadlineSource: "provisional",
		...overrides,
	};
}

describe("canLearnerSetDeadline", () => {
	it("allows it on a settled, earn-back order the creator left open", () => {
		expect(canLearnerSetDeadline(order())).toBe(true);
	});

	it("refuses when the creator fixed the window", () => {
		expect(
			canLearnerSetDeadline(order({ earnBackDeadlineSource: "creator" })),
		).toBe(false);
	});

	it("refuses once the learner has already committed", () => {
		expect(
			canLearnerSetDeadline(order({ earnBackDeadlineSource: "learner" })),
		).toBe(false);
	});

	it("refuses before the order settles — there is no clock to start yet", () => {
		expect(canLearnerSetDeadline(order({ status: "pending" }))).toBe(false);
	});

	it("refuses once earn-back has already resolved", () => {
		expect(canLearnerSetDeadline(order({ status: "earn_back_issued" }))).toBe(
			false,
		);
	});

	it("refuses on content with no earn-back at all", () => {
		expect(canLearnerSetDeadline(order({ isEarnBackEligible: false }))).toBe(
			false,
		);
	});
});

describe("rejectDeadlineCommit", () => {
	it("accepts a day count inside the frozen window", () => {
		expect(rejectDeadlineCommit(order(), 30)).toBeNull();
	});

	it("accepts exactly the frozen maximum", () => {
		expect(rejectDeadlineCommit(order({ earnBackDeadlineDays: 60 }), 60)).toBe(
			null,
		);
	});

	it("refuses a promise to finish LATER than the frozen window", () => {
		// The learner may only commit to finishing sooner.
		expect(rejectDeadlineCommit(order({ earnBackDeadlineDays: 60 }), 61)).toBe(
			"out_of_range",
		);
	});

	it.each([0, -5, 1.5, Number.NaN])("refuses %s days", (days) => {
		expect(rejectDeadlineCommit(order(), days)).toBe("out_of_range");
	});

	it("names the creator when the window is fixed", () => {
		expect(
			rejectDeadlineCommit(order({ earnBackDeadlineSource: "creator" }), 10),
		).toBe("fixed_by_creator");
	});

	it("refuses a second commit — the lock is what makes it a commitment", () => {
		expect(
			rejectDeadlineCommit(order({ earnBackDeadlineSource: "learner" }), 10),
		).toBe("already_set");
	});

	it("refuses before settlement", () => {
		expect(rejectDeadlineCommit(order({ status: "pending" }), 10)).toBe(
			"not_settled",
		);
	});

	it("refuses on non-earn-back content", () => {
		expect(rejectDeadlineCommit(order({ isEarnBackEligible: false }), 10)).toBe(
			"not_eligible",
		);
	});
});

describe("deadlineFrom", () => {
	it("measures the window from payment, not from the moment of choosing", () => {
		const paidAt = new Date("2026-07-01T00:00:00.000Z");
		expect(deadlineFrom(paidAt, 30).toISOString()).toBe(
			"2026-07-31T00:00:00.000Z",
		);
	});
});
