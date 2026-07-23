// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderInAcademy, renderWithRouter } from "@/test/render";
import { SiteFooter } from "./site-footer";

vi.mock("@/lib/content-api", () => ({
	getAcademies: vi.fn().mockResolvedValue([
		{ slug: "teachers", name: "Teacher Academy" },
		{ slug: "tech", name: "Tech Academy" },
	]),
}));

describe("SiteFooter", () => {
	it("renders the academy catalogue links in the desktop column and the mobile-only ones", async () => {
		// Inside an academy the "Learn" column shows that academy's catalogue.
		renderInAcademy(<SiteFooter />);
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

	it("lists the academies (not a defaulted catalogue) on global pages", async () => {
		// Off any academy the "Learn" column offers the academies themselves,
		// never a silently-defaulted academy's Courses/Paths/Cohorts.
		renderWithRouter(<SiteFooter />);
		expect(
			await screen.findByRole("link", { name: "Tech Academy" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Teacher Academy" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: "Learning Paths" }),
		).not.toBeInTheDocument();
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
