// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AntiCheatSummary } from "@/lib/analytics-trends-api";
import { renderWithProviders } from "@/test/render";
import { AntiCheatSummaryCard } from "./anti-cheat-summary";

const { summaryMock } = vi.hoisted(() => ({ summaryMock: vi.fn() }));

vi.mock("@/lib/analytics-trends-api", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/analytics-trends-api")>();
	return { ...actual, getAntiCheatSummary: summaryMock };
});

function summary(over: Partial<AntiCheatSummary> = {}): AntiCheatSummary {
	return {
		attempts: 20,
		flagged: 3,
		unmonitored: 1,
		escalated: 0,
		invalidated: 0,
		eventCounts: [
			{ eventType: "tab_switch", count: 5 },
			{ eventType: "camera_monitor_unavailable", count: 1 },
		],
		...over,
	};
}

describe("AntiCheatSummaryCard (§15)", () => {
	beforeEach(() => vi.clearAllMocks());

	it("shows the five integrity stats, with unmonitored as its own number", async () => {
		summaryMock.mockResolvedValue(summary());
		renderWithProviders(<AntiCheatSummaryCard />);

		expect(await screen.findByText("Attempts")).toBeInTheDocument();
		// §4.6.2.1: unmonitored attempts score a clean 100 — this card is the
		// one place they surface without an admin going digging.
		expect(screen.getByText("Unmonitored")).toBeInTheDocument();
		expect(screen.getByText("20")).toBeInTheDocument();
	});

	it("names event types in human words, ranked", async () => {
		summaryMock.mockResolvedValue(summary());
		renderWithProviders(<AntiCheatSummaryCard />);

		expect(await screen.findByText("Tab switch")).toBeInTheDocument();
		expect(screen.getByText("Monitoring unavailable")).toBeInTheDocument();
	});

	it("says quiet is good instead of rendering an empty plot", async () => {
		summaryMock.mockResolvedValue(
			summary({ flagged: 0, unmonitored: 0, eventCounts: [] }),
		);
		renderWithProviders(<AntiCheatSummaryCard />);
		expect(await screen.findByText(/Quiet is good/)).toBeInTheDocument();
	});
});
