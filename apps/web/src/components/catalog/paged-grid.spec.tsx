// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { PagedGrid } from "./paged-grid";

const ITEMS = Array.from({ length: 25 }, (_, i) => `item-${i}`);

const realMatchMedia = window.matchMedia;
afterEach(() => {
	window.matchMedia = realMatchMedia;
});

function mockDesktop(matches: boolean) {
	window.matchMedia = vi.fn().mockReturnValue({
		matches,
		addEventListener: () => {},
		removeEventListener: () => {},
	}) as unknown as typeof window.matchMedia;
}

describe("PagedGrid", () => {
	it("shows only the first page of items", () => {
		mockDesktop(false);
		renderWithProviders(
			<PagedGrid
				items={ITEMS}
				getKey={(i) => i}
				render={(i) => <span>{i}</span>}
				pageSize={9}
			/>,
		);
		expect(screen.getAllByText(/item-/)).toHaveLength(9);
	});

	it("shows a 'Load more' button on desktop, revealing the next page on click", async () => {
		mockDesktop(true);
		const user = userEvent.setup();
		renderWithProviders(
			<PagedGrid
				items={ITEMS}
				getKey={(i) => i}
				render={(i) => <span>{i}</span>}
				pageSize={9}
			/>,
		);
		expect(screen.getAllByText(/item-/)).toHaveLength(9);

		await user.click(screen.getByRole("button", { name: "Load more" }));
		expect(screen.getAllByText(/item-/)).toHaveLength(18);
	});

	it("has no 'Load more' button on mobile (infinite-scroll sentinel instead)", () => {
		mockDesktop(false);
		renderWithProviders(
			<PagedGrid
				items={ITEMS}
				getKey={(i) => i}
				render={(i) => <span>{i}</span>}
				pageSize={9}
			/>,
		);
		expect(
			screen.queryByRole("button", { name: "Load more" }),
		).not.toBeInTheDocument();
	});

	it("resets to the first page when resetKey changes", () => {
		mockDesktop(true);
		const { rerender } = renderWithProviders(
			<PagedGrid
				items={ITEMS}
				getKey={(i) => i}
				render={(i) => <span>{i}</span>}
				pageSize={9}
				resetKey="all"
			/>,
		);
		expect(screen.getAllByText(/item-/)).toHaveLength(9);

		rerender(
			<PagedGrid
				items={ITEMS.slice(0, 5)}
				getKey={(i) => i}
				render={(i) => <span>{i}</span>}
				pageSize={9}
				resetKey="filtered"
			/>,
		);
		expect(screen.getAllByText(/item-/)).toHaveLength(5);
	});
});
