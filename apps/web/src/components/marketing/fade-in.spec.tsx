// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FadeIn } from "./fade-in";

describe("FadeIn", () => {
	it("renders its children (content is present regardless of scroll/animation state)", () => {
		render(
			<FadeIn>
				<p>Revealed content</p>
			</FadeIn>,
		);
		expect(screen.getByText("Revealed content")).toBeInTheDocument();
	});
});
