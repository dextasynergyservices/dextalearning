// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FunnelStage } from "@/lib/analytics-trends-api";
import { renderWithProviders } from "@/test/render";
import { CompletionFunnel } from "./completion-funnel";

const { funnelMock } = vi.hoisted(() => ({ funnelMock: vi.fn() }));

vi.mock("@/lib/analytics-trends-api", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/analytics-trends-api")>();
	return { ...actual, getCompletionFunnel: funnelMock };
});

function stages(
	enrolled: number,
	started: number,
	completed: number,
): { title: string; stages: FunnelStage[] } {
	return {
		title: "T",
		stages: [
			{ key: "enrolled", count: enrolled },
			{ key: "started", count: started },
			{ key: "completed", count: completed },
		],
	};
}

describe("CompletionFunnel (§15)", () => {
	beforeEach(() => vi.clearAllMocks());

	it("labels every stage directly with count and conversion from previous", async () => {
		funnelMock.mockResolvedValue(stages(10, 5, 2));
		renderWithProviders(<CompletionFunnel entityType="course" entityId="c1" />);

		expect(await screen.findByText("Enrolled")).toBeInTheDocument();
		expect(screen.getByText("Started")).toBeInTheDocument();
		expect(screen.getByText("Completed")).toBeInTheDocument();
		// 5 of 10 → 50% of previous; 2 of 5 → 40% of previous.
		expect(screen.getByText(/50% of previous/)).toBeInTheDocument();
		expect(screen.getByText(/40% of previous/)).toBeInTheDocument();
	});

	it("says so when the funnel is empty instead of drawing nothing", async () => {
		funnelMock.mockResolvedValue(stages(0, 0, 0));
		renderWithProviders(<CompletionFunnel entityType="cohort" entityId="x" />);
		expect(await screen.findByText(/No enrolments yet/)).toBeInTheDocument();
	});

	/** The dataviz a11y rule: the chart's numbers exist as a real table too. */
	it("offers the same data as an accessible table", async () => {
		funnelMock.mockResolvedValue(stages(10, 5, 2));
		renderWithProviders(<CompletionFunnel entityType="course" entityId="c1" />);
		await screen.findByText("Enrolled");

		await userEvent.click(
			screen.getByRole("button", { name: /view as table/i }),
		);

		const table = screen.getByRole("table");
		expect(table).toBeInTheDocument();
		expect(screen.getByRole("cell", { name: "10" })).toBeInTheDocument();
		expect(screen.getByRole("cell", { name: "2" })).toBeInTheDocument();
	});
});
