// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ActivityHeatmap } from "./activity-heatmap";

const { heatmapMock } = vi.hoisted(() => ({ heatmapMock: vi.fn() }));

vi.mock("@/lib/analytics-trends-api", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/analytics-trends-api")>();
	return { ...actual, getActivityHeatmap: heatmapMock };
});

describe("ActivityHeatmap (§15.2)", () => {
	beforeEach(() => vi.clearAllMocks());

	it("labels every cell with its numbers — nothing is color-alone", async () => {
		heatmapMock.mockResolvedValue([{ dow: 1, hour: 14, count: 7 }]);
		renderWithProviders(<ActivityHeatmap />);

		// 7×24 = 168 cells, each an accessible img with day/hour/count text.
		const cells = await screen.findAllByRole("img");
		expect(cells).toHaveLength(168);
		expect(
			screen.getByRole("img", { name: /14:00 — 7 events/ }),
		).toBeInTheDocument();
	});

	it("says so when the window is quiet", async () => {
		heatmapMock.mockResolvedValue([]);
		renderWithProviders(<ActivityHeatmap />);
		expect(
			await screen.findByText(/No learning activity in this window/),
		).toBeInTheDocument();
	});
});
