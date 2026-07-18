// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { EarnBackOutcomesCard, OutcomeDonutCard } from "./composition-cards";

const { outcomesMock, earnBackMock } = vi.hoisted(() => ({
	outcomesMock: vi.fn(),
	earnBackMock: vi.fn(),
}));

vi.mock("@/lib/analytics-trends-api", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/analytics-trends-api")>();
	return {
		...actual,
		getOutcomeDistribution: outcomesMock,
		getEarnBackOutcomes: earnBackMock,
	};
});

describe("composition donuts (§15.2)", () => {
	beforeEach(() => vi.clearAllMocks());

	it("renders the outcome slices with values and shares", async () => {
		outcomesMock.mockResolvedValue({
			notStarted: 5,
			inProgress: 3,
			completed: 2,
		});
		renderWithProviders(<OutcomeDonutCard />);

		expect(await screen.findByText("Completed")).toBeInTheDocument();
		expect(screen.getByText("In progress")).toBeInTheDocument();
		expect(screen.getByText("Not started")).toBeInTheDocument();
		// Shares: 2/10, 3/10, 5/10 — direct labels, not tooltip-only.
		expect(screen.getByText("20%")).toBeInTheDocument();
		expect(screen.getByText("50%")).toBeInTheDocument();
		// Centre headline re-sums to total enrolments.
		expect(screen.getByText("10")).toBeInTheDocument();
	});

	it("says so when there is nothing to compose", async () => {
		earnBackMock.mockResolvedValue({ onTime: 0, late: 0, missed: 0 });
		renderWithProviders(<EarnBackOutcomesCard />);
		expect(
			await screen.findByText(/No resolved Earn-Back sales yet/),
		).toBeInTheDocument();
	});

	it("frames on-time as the learner winning, not the creator losing", async () => {
		earnBackMock.mockResolvedValue({ onTime: 4, late: 1, missed: 1 });
		renderWithProviders(<EarnBackOutcomesCard />);
		expect(await screen.findByText("Finished on time")).toBeInTheDocument();
		expect(screen.getByText(/the deal working/)).toBeInTheDocument();
	});
});
