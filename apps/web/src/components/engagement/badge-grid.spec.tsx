// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { BadgeGrid } from "./badge-grid";

const ALL_KEYS = ["first_lesson", "lessons_10", "streak_7"];

describe("BadgeGrid", () => {
	it("shows earned badges with their date and locked ones with criteria", () => {
		renderWithProviders(
			<BadgeGrid
				badges={[
					{
						key: "first_lesson",
						awardedAt: "2026-07-01T10:00:00Z",
						seen: true,
					},
				]}
				allKeys={ALL_KEYS}
			/>,
		);
		// Earned: name + date.
		expect(screen.getByText("First Steps")).toBeInTheDocument();
		expect(screen.getByText(/Earned/)).toBeInTheDocument();
		// Locked: name + criteria hint + lock marker.
		expect(screen.getByText("Deep Diver")).toBeInTheDocument();
		expect(screen.getByText("Complete 10 lessons")).toBeInTheDocument();
		expect(screen.getAllByLabelText("Locked")).toHaveLength(2);
	});

	it("shows the earned-count summary", () => {
		renderWithProviders(
			<BadgeGrid
				badges={[
					{
						key: "first_lesson",
						awardedAt: "2026-07-01T10:00:00Z",
						seen: true,
					},
				]}
				allKeys={ALL_KEYS}
			/>,
		);
		expect(screen.getByText("1 of 3 earned")).toBeInTheDocument();
	});
});
