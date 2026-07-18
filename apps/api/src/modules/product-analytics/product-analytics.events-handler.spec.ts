import { describe, expect, it, vi } from "vitest";
import type { AnalyticsPort } from "../../shared/analytics/analytics.port";
import { ProductAnalyticsEventsHandler } from "./product-analytics.events-handler";

function build() {
	const capture = vi.fn();
	const port: AnalyticsPort = { capture, shutdown: async () => {} };
	return { capture, handler: new ProductAnalyticsEventsHandler(port) };
}

/**
 * These event names + property shapes are what PostHog dashboards get built
 * on — once live, a rename breaks every funnel silently. Pin them.
 */
describe("ProductAnalyticsEventsHandler (§15)", () => {
	it("maps an enrollment to enrollment_created keyed by the learner", () => {
		const { capture, handler } = build();
		handler.onEnrollment({
			userId: "u1",
			entityType: "course",
			entityId: "c1",
		});
		expect(capture).toHaveBeenCalledWith({
			distinctId: "u1",
			event: "enrollment_created",
			properties: { entity_type: "course", entity_id: "c1" },
		});
	});

	it("maps an assessment submission with score + pass verdict", () => {
		const { capture, handler } = build();
		handler.onAttemptSubmitted({
			userId: "u1",
			assessmentId: "a1",
			lessonId: null,
			scope: "course_final",
			score: 80,
			passed: true,
			attemptNumber: 2,
		});
		expect(capture).toHaveBeenCalledWith({
			distinctId: "u1",
			event: "assessment_submitted",
			properties: {
				assessment_id: "a1",
				scope: "course_final",
				score: 80,
				passed: true,
				attempt_number: 2,
			},
		});
	});

	/**
	 * Money never rides the analytics stream: events are at-most-once, so any
	 * revenue figure there would eventually disagree with the settled-orders
	 * ledger (§14.1.1) — and the ledger must win. Pin the absence.
	 */
	it("sends order_settled WITHOUT any amount", () => {
		const { capture, handler } = build();
		handler.onPaymentConfirmed({
			orderId: "o1",
			userId: "u1",
			entityType: "course",
			entityId: "c1",
			entityTitle: "T",
		});
		const call = capture.mock.calls[0][0];
		expect(call.event).toBe("order_settled");
		expect(JSON.stringify(call.properties)).not.toMatch(/amount|price|fee/i);
	});

	it("keeps the earn-back refund to behavioural facts only", () => {
		const { capture, handler } = build();
		handler.onEarnBackProcessed({
			transactionId: "t1",
			userId: "u1",
			amount: 7125,
			currency: "NGN",
			entityTitle: "T",
			daysLate: 3,
		});
		expect(capture).toHaveBeenCalledWith({
			distinctId: "u1",
			event: "earn_back_refunded",
			properties: { days_late: 3 },
		});
	});
});
