// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { StreakFlame } from "./streak-flame";

describe("StreakFlame", () => {
	it("shows the streak count with an accessible day-streak label", () => {
		renderWithProviders(<StreakFlame current={5} />);
		expect(screen.getByLabelText("5-day streak")).toBeInTheDocument();
		expect(screen.getByText("5")).toBeInTheDocument();
	});

	it("renders an unlit (muted) flame at zero", () => {
		renderWithProviders(<StreakFlame current={0} />);
		expect(screen.getByText("0")).toHaveClass("text-muted-foreground");
	});

	it("renders the amber at-risk state", () => {
		renderWithProviders(<StreakFlame current={3} atRisk />);
		expect(screen.getByText("3")).toHaveClass("text-amber-600");
	});
});
