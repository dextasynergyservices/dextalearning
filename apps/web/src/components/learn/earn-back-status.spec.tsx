// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EarnBackStatus as EarnBackStatusData } from "@/lib/payments-api";
import { renderWithProviders } from "@/test/render";
import { EarnBackStatus } from "./earn-back-status";

const { getEarnBackStatusMock } = vi.hoisted(() => ({
	getEarnBackStatusMock: vi.fn(),
}));

vi.mock("@/lib/payments-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/payments-api")>();
	return { ...actual, getEarnBackStatus: getEarnBackStatusMock };
});

/** A resolved Earn-Back, overridable per case. */
function resolved(
	overrides: Partial<EarnBackStatusData> = {},
): EarnBackStatusData {
	return {
		base: 7125,
		currency: "NGN",
		deadline: "2026-09-13T00:00:00.000Z",
		phase: "resolved",
		refundAmount: 7125,
		outcome: "processed",
		refundedAt: "2026-07-15T14:32:36.000Z",
		deadlineSource: "creator",
		canSetDeadline: false,
		maxDays: 60,
		...overrides,
	};
}

describe("EarnBackStatus (§4.11.5)", () => {
	beforeEach(() => vi.clearAllMocks());

	it("tells a refunded learner when to expect the money", async () => {
		getEarnBackStatusMock.mockResolvedValue(resolved());
		renderWithProviders(<EarnBackStatus type="course" entityId="c1" />);

		expect(await screen.findByText(/Earn-Back on its way/)).toBeInTheDocument();
		// The ETA is the whole point: without it, silence reads as a lost refund.
		expect(await screen.findByText(/5–10 business days/)).toBeInTheDocument();
	});

	/**
	 * The regression this file exists for. A queued-but-unacknowledged refund
	 * used to fall through to the no-Earn-Back branch, telling a learner owed
	 * ₦7,125 that they were getting nothing.
	 */
	it("shows an in-flight refund as sending, never as 'no Earn-Back'", async () => {
		getEarnBackStatusMock.mockResolvedValue(
			resolved({ outcome: "pending", refundedAt: null }),
		);
		renderWithProviders(<EarnBackStatus type="course" entityId="c1" />);

		expect(
			await screen.findByText(/Sending your Earn-Back/),
		).toBeInTheDocument();
		expect(
			screen.queryByText(/No Earn-Back remaining/),
		).not.toBeInTheDocument();
	});

	it("names the amount at stake when a refund fails", async () => {
		getEarnBackStatusMock.mockResolvedValue(
			resolved({ outcome: "failed", refundedAt: null }),
		);
		renderWithProviders(<EarnBackStatus type="course" entityId="c1" />);

		expect(
			await screen.findByText(/We're processing your Earn-Back/),
		).toBeInTheDocument();
		expect(await screen.findByText(/isn't lost/)).toBeInTheDocument();
	});

	it("only says 'no Earn-Back remaining' when nothing is owed", async () => {
		getEarnBackStatusMock.mockResolvedValue(
			resolved({ outcome: "no_payout", refundAmount: 0, refundedAt: null }),
		);
		renderWithProviders(<EarnBackStatus type="course" entityId="c1" />);

		expect(
			await screen.findByText(/No Earn-Back remaining/),
		).toBeInTheDocument();
	});
});
