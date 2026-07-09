// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EntityLearner } from "@/lib/analytics-api";
import { renderWithProviders } from "@/test/render";
import { LearnerAnalyticsList } from "./learner-analytics-list";

function learner(over: Partial<EntityLearner> = {}): EntityLearner {
	return {
		userId: crypto.randomUUID(),
		name: "Chinwe Okafor",
		enrolledAt: "2026-07-01T00:00:00Z",
		progressPercent: 40,
		isComplete: false,
		completedAt: null,
		...over,
	};
}

describe("LearnerAnalyticsList", () => {
	it("lists learners and opens per-student detail on click", async () => {
		const onOpen = vi.fn();
		const user = userEvent.setup();
		renderWithProviders(
			<LearnerAnalyticsList
				learners={[
					learner({ name: "Chinwe Okafor", progressPercent: 40 }),
					learner({ name: "Femi Ade", progressPercent: 100, isComplete: true }),
				]}
				onOpen={onOpen}
			/>,
		);
		expect(screen.getAllByText("Chinwe Okafor").length).toBeGreaterThan(0);
		await user.click(screen.getAllByRole("button", { name: /Femi Ade/ })[0]);
		expect(onOpen).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Femi Ade" }),
		);
	});

	it("renders the empty state when no one is enrolled", () => {
		renderWithProviders(
			<LearnerAnalyticsList learners={[]} onOpen={vi.fn()} />,
		);
		expect(screen.getByText("No one has enrolled yet.")).toBeInTheDocument();
	});
});
