// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "@/test/render";
import { BottomTabBar } from "./bottom-tab-bar";

describe("BottomTabBar", () => {
	it("renders the primary tabs and a More button", async () => {
		renderWithRouter(<BottomTabBar />);
		expect(
			await screen.findByRole("link", { name: /Home/ }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Courses/ })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Paths/ })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Cohorts/ })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /More/ })).toBeInTheDocument();
	});

	it("opens the More sheet with the secondary links, and closes on overlay click", async () => {
		const user = userEvent.setup();
		renderWithRouter(<BottomTabBar />);
		await user.click(await screen.findByRole("button", { name: /More/ }));

		expect(
			await screen.findByRole("link", { name: "Blog" }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Community" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Contact" })).toBeInTheDocument();

		// Two "More" buttons now exist (the tab-bar trigger + the sheet's overlay,
		// both share the aria-label) — the overlay is the last one in DOM order.
		const moreButtons = screen.getAllByRole("button", { name: /More/ });
		await user.click(moreButtons[moreButtons.length - 1]);
		await waitFor(() => {
			expect(
				screen.queryByRole("link", { name: "Blog" }),
			).not.toBeInTheDocument();
		});
	});
});
