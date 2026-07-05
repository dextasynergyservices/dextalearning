// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Reveal } from "./reveal";

const realMatchMedia = window.matchMedia;
afterEach(() => {
	window.matchMedia = realMatchMedia;
});

describe("Reveal", () => {
	it("renders its children", () => {
		render(
			<Reveal>
				<p>One</p>
				<p>Two</p>
			</Reveal>,
		);
		expect(screen.getByText("One")).toBeInTheDocument();
		expect(screen.getByText("Two")).toBeInTheDocument();
	});

	it("still renders children in place under prefers-reduced-motion", () => {
		window.matchMedia = vi.fn().mockReturnValue({
			matches: true,
			addEventListener: () => {},
			removeEventListener: () => {},
		}) as unknown as typeof window.matchMedia;

		render(
			<Reveal>
				<p>Static content</p>
			</Reveal>,
		);
		expect(screen.getByText("Static content")).toBeInTheDocument();
	});
});
