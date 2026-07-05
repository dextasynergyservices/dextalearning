// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderRoute } from "@/test/render-route";

describe("AboutPage", () => {
	it("renders the hero, mission and beliefs", async () => {
		renderRoute("/about");

		expect(
			await screen.findByText(
				"Learning, redesigned around how people actually learn",
			),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"To make deep, lasting learning the default, not the exception — for every educator, in every classroom.",
			),
		).toBeInTheDocument();
		expect(screen.getByText("Science over hype")).toBeInTheDocument();
		expect(screen.getByText("Finishing matters")).toBeInTheDocument();
		expect(screen.getByText("Built for everyone")).toBeInTheDocument();
	});

	it("renders the stat labels and a CTA link to register", async () => {
		renderRoute("/about");

		expect(
			await screen.findByText("Completion on Earn-Back courses"),
		).toBeInTheDocument();
		expect(screen.getByText("Educators learning")).toBeInTheDocument();
		// The header's own CTA also says "Get started" — check every match links home.
		const ctas = screen.getAllByRole("link", { name: /Get started/ });
		for (const cta of ctas) {
			expect(cta).toHaveAttribute("href", "/register");
		}
	});
});
