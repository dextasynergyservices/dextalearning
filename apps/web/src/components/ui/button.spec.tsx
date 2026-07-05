// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

describe("Button", () => {
	it("defaults to type=button (never accidentally submits a form)", () => {
		render(<Button>Click</Button>);
		expect(screen.getByRole("button")).toHaveAttribute("type", "button");
	});

	it("respects an explicit type override", () => {
		render(<Button type="submit">Submit</Button>);
		expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
	});

	it("applies the variant and size classes", () => {
		render(
			<Button variant="outline" size="lg">
				Outline
			</Button>,
		);
		const btn = screen.getByRole("button");
		expect(btn).toHaveClass("border-brand-primary/30");
		expect(btn).toHaveClass("h-13");
	});

	it("is disabled and inert when disabled is set", async () => {
		const onClick = vi.fn();
		render(
			<Button disabled onClick={onClick}>
				Disabled
			</Button>,
		);
		expect(screen.getByRole("button")).toBeDisabled();
	});
});
