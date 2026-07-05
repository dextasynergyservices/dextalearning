// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { FilterChips } from "./filter-chips";

const LEVELS = ["all", "beginner", "intermediate"] as const;

describe("FilterChips", () => {
	it("renders a translated chip per item", () => {
		renderWithProviders(
			<FilterChips
				items={LEVELS}
				active="all"
				onChange={vi.fn()}
				labelPrefix="level"
			/>,
		);
		expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Beginner" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Intermediate" }),
		).toBeInTheDocument();
	});

	it("marks the active chip distinctly from the rest", () => {
		renderWithProviders(
			<FilterChips
				items={LEVELS}
				active="beginner"
				onChange={vi.fn()}
				labelPrefix="level"
			/>,
		);
		expect(screen.getByRole("button", { name: "Beginner" })).toHaveClass(
			"bg-brand-primary",
		);
		expect(screen.getByRole("button", { name: "All" })).not.toHaveClass(
			"bg-brand-primary",
		);
	});

	it("calls onChange with the clicked item's key", async () => {
		const onChange = vi.fn();
		const user = userEvent.setup();
		renderWithProviders(
			<FilterChips
				items={LEVELS}
				active="all"
				onChange={onChange}
				labelPrefix="level"
			/>,
		);
		await user.click(screen.getByRole("button", { name: "Intermediate" }));
		expect(onChange).toHaveBeenCalledWith("intermediate");
	});
});
