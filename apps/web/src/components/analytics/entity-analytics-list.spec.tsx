// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EntityAnalyticsRow } from "@/lib/analytics-api";
import { renderWithProviders } from "@/test/render";
import { EntityAnalyticsList } from "./entity-analytics-list";

function row(over: Partial<EntityAnalyticsRow> = {}): EntityAnalyticsRow {
	return {
		id: crypto.randomUUID(),
		title: "React Basics",
		status: "published",
		live: true,
		enrolled: 10,
		completed: 4,
		inProgress: 3,
		notStarted: 3,
		completionRate: 40,
		avgProgressPct: 55,
		lastEnrolledAt: "2026-07-01T00:00:00Z",
		...over,
	};
}

describe("EntityAnalyticsList", () => {
	it("renders rows and opens one on click (drill-down)", async () => {
		const onOpen = vi.fn();
		const user = userEvent.setup();
		renderWithProviders(
			<EntityAnalyticsList
				rows={[row({ title: "React Basics" })]}
				entityLabel="Course"
				onOpen={onOpen}
			/>,
		);
		// Title shows (mobile card + desktop cell both in jsdom).
		expect(screen.getAllByText("React Basics").length).toBeGreaterThan(0);
		// Click the mobile card (a button).
		await user.click(
			screen.getAllByRole("button", { name: /React Basics/ })[0],
		);
		expect(onOpen).toHaveBeenCalledWith(
			expect.objectContaining({ title: "React Basics" }),
		);
	});

	it("shows the instructor name only in admin mode", () => {
		const { rerender } = renderWithProviders(
			<EntityAnalyticsList
				rows={[row({ instructorName: "Ada Lovelace" })]}
				entityLabel="Course"
				onOpen={vi.fn()}
			/>,
		);
		expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();

		rerender(
			<EntityAnalyticsList
				rows={[row({ instructorName: "Ada Lovelace" })]}
				entityLabel="Course"
				showInstructor
				onOpen={vi.fn()}
			/>,
		);
		expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0);
	});

	it("renders the empty state", () => {
		renderWithProviders(
			<EntityAnalyticsList rows={[]} entityLabel="Course" onOpen={vi.fn()} />,
		);
		expect(
			screen.getByText(/analytics appear once learners enrol/i),
		).toBeInTheDocument();
	});
});
