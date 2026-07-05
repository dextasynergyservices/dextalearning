// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "@/test/render";
import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
	it("renders the desktop column links and the mobile-only ones", async () => {
		renderWithRouter(<SiteFooter />);
		// Desktop and mobile layouts both render (CSS toggles visibility), so a
		// label shared by both (e.g. "Courses") appears twice.
		expect(
			(await screen.findAllByRole("link", { name: "Courses" })).length,
		).toBe(2);
		// "Learning Paths" is desktop-column only.
		expect(
			screen.getByRole("link", { name: "Learning Paths" }),
		).toBeInTheDocument();
	});

	it("renders the current year in the copyright line", async () => {
		renderWithRouter(<SiteFooter />);
		const year = new Date().getFullYear().toString();
		expect(
			(await screen.findAllByText((text) => text.includes(year))).length,
		).toBeGreaterThan(0);
	});

	it("renders a social link per platform", async () => {
		renderWithRouter(<SiteFooter />);
		expect(
			(await screen.findAllByRole("link", { name: "Facebook" })).length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByRole("link", { name: "YouTube" }).length,
		).toBeGreaterThan(0);
	});
});
