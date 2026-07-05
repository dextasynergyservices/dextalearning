// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "@/test/render";
import { PagePlaceholder } from "./page-placeholder";

describe("PagePlaceholder", () => {
	it("renders the title and description for a known page key", async () => {
		renderWithRouter(<PagePlaceholder tKey="about" />);
		expect(await screen.findByText("About DextaLearning")).toBeInTheDocument();
		expect(
			screen.getByText(
				"The story and mission behind a behavior-driven Learning Operating System.",
			),
		).toBeInTheDocument();
	});

	it("falls back to the generic eyebrow when the page has none of its own", async () => {
		renderWithRouter(<PagePlaceholder tKey="about" />);
		expect(await screen.findByText("Coming together")).toBeInTheDocument();
	});

	it("uses the page's own eyebrow when one is defined", async () => {
		renderWithRouter(<PagePlaceholder tKey="login" />);
		expect(await screen.findByText("Account")).toBeInTheDocument();
	});

	it("links back home", async () => {
		renderWithRouter(<PagePlaceholder tKey="about" />);
		expect(
			await screen.findByRole("link", { name: "Back to home" }),
		).toHaveAttribute("href", "/");
	});
});
