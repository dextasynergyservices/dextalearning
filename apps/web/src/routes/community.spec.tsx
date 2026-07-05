// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderRoute } from "@/test/render-route";

describe("CommunityPage", () => {
	it("renders the hero and learner voices", async () => {
		renderRoute("/community");

		expect(
			await screen.findByText("You learn faster when you're not alone"),
		).toBeInTheDocument();
		expect(screen.getByText("Chinwe A.")).toBeInTheDocument();
		expect(
			screen.getByText(
				'"My cohort group became my staffroom away from school. We pushed each other to finish."',
			),
		).toBeInTheDocument();
	});

	it("renders the ways to get involved and a CTA link to register", async () => {
		renderRoute("/community");

		expect(await screen.findByText("Join a cohort")).toBeInTheDocument();
		expect(screen.getByText("Find your group")).toBeInTheDocument();
		expect(screen.getByText("Share your story")).toBeInTheDocument();
		const cta = screen.getByRole("link", { name: /Join the community/ });
		expect(cta).toHaveAttribute("href", "/register");
	});
});
