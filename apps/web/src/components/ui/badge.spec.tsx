// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
	it("renders its children", () => {
		render(<Badge>Open</Badge>);
		expect(screen.getByText("Open")).toBeInTheDocument();
	});

	it("applies the tone variant's classes", () => {
		render(<Badge tone="free">Free</Badge>);
		expect(screen.getByText("Free")).toHaveClass(
			"bg-brand-primary-light",
			"text-brand-primary",
		);
	});

	it("defaults to the neutral tone when none is given", () => {
		render(<Badge>Untoned</Badge>);
		expect(screen.getByText("Untoned")).toHaveClass(
			"bg-muted",
			"text-muted-foreground",
		);
	});

	it("merges a custom className alongside the variant classes", () => {
		render(
			<Badge tone="open" className="ml-2">
				Live
			</Badge>,
		);
		const el = screen.getByText("Live");
		expect(el).toHaveClass("ml-2");
		expect(el).toHaveClass("bg-success/10");
	});
});
