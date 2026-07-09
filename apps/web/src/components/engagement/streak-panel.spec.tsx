// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StreakState, WeekActivityDay } from "@/lib/engagement-api";
import { renderWithProviders } from "@/test/render";
import { StreakPanel } from "./streak-panel";

function streak(overrides: Partial<StreakState> = {}): StreakState {
	return {
		current: 4,
		longest: 9,
		freezes: 1,
		lastActiveDate: "2026-07-05",
		atRisk: false,
		todayDone: true,
		...overrides,
	};
}

function week(activeCount = 3): WeekActivityDay[] {
	return Array.from({ length: 7 }, (_, i) => ({
		date: `2026-06-3${i < 2 ? i : 0}`.slice(0, 10),
		active: i >= 7 - activeCount,
	})).map((d, i) => ({ ...d, date: `2026-07-0${i + 1}` }));
}

describe("StreakPanel", () => {
	it("shows current, longest and the freeze explainer", () => {
		renderWithProviders(
			<StreakPanel streak={streak()} weekActivity={week()} />,
		);
		expect(screen.getByText("4")).toBeInTheDocument();
		expect(screen.getByText(/Longest: 9/)).toBeInTheDocument();
		expect(screen.getByText(/A freeze saves your streak/)).toBeInTheDocument();
	});

	it("renders 7 week dots with the active days marked", () => {
		const { container } = renderWithProviders(
			<StreakPanel streak={streak()} weekActivity={week(3)} />,
		);
		const dots = container.querySelectorAll("[data-active]");
		expect(dots).toHaveLength(3);
	});

	it("leads with the loss-aversion line when the streak is at risk", () => {
		renderWithProviders(
			<StreakPanel
				streak={streak({ atRisk: true, todayDone: false })}
				weekActivity={week()}
			/>,
		);
		expect(
			screen.getByText(/Don't lose your 4-day streak/),
		).toBeInTheDocument();
	});

	it("invites a first lesson when there's no streak yet", () => {
		renderWithProviders(
			<StreakPanel
				streak={streak({ current: 0, todayDone: false, lastActiveDate: null })}
				weekActivity={week(0)}
			/>,
		);
		expect(
			screen.getByText(/Complete a lesson today to light your flame/),
		).toBeInTheDocument();
	});
});
