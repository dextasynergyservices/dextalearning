// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressRing } from "./progress-ring";

describe("ProgressRing", () => {
	it("shows the rounded percentage as its accessible label and center text", () => {
		render(<ProgressRing value={42.6} />);
		expect(screen.getByRole("img", { name: "43%" })).toBeInTheDocument();
		expect(screen.getByText("43%")).toBeInTheDocument();
	});

	it("clamps values above 100 down to 100%", () => {
		render(<ProgressRing value={150} />);
		expect(screen.getByText("100%")).toBeInTheDocument();
	});

	it("clamps negative values up to 0%", () => {
		render(<ProgressRing value={-10} />);
		expect(screen.getByText("0%")).toBeInTheDocument();
	});
});
