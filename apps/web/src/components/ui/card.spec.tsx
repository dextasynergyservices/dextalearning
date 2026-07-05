// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./card";

describe("Card", () => {
	it("renders its children", () => {
		render(<Card>Content</Card>);
		expect(screen.getByText("Content")).toBeInTheDocument();
	});

	it("does not apply interactive hover classes by default", () => {
		render(<Card data-testid="card">Content</Card>);
		expect(screen.getByTestId("card")).not.toHaveClass(
			"hover:-translate-y-0.5",
		);
	});

	it("applies interactive hover/tap classes when interactive is set", () => {
		render(
			<Card interactive data-testid="card">
				Content
			</Card>,
		);
		expect(screen.getByTestId("card")).toHaveClass("hover:-translate-y-0.5");
	});
});
