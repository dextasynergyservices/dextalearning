// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentSearchResult } from "@/lib/search-api";
import { renderWithRouter } from "@/test/render";
import { ContentSearch } from "./content-search";

describe("ContentSearch", () => {
	let fetcher: ReturnType<
		typeof vi.fn<(q: string) => Promise<ContentSearchResult[]>>
	>;

	beforeEach(() => {
		fetcher = vi.fn();
	});

	it("does not search for very short input", async () => {
		const user = userEvent.setup();
		renderWithRouter(<ContentSearch scopeId="c1" fetcher={fetcher} />);

		await user.type(await screen.findByLabelText("Search course content"), "a");
		// Debounce + min length 2 → no call.
		await new Promise((r) => setTimeout(r, 450));
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("searches (debounced) and lists matching lessons with snippets", async () => {
		fetcher.mockResolvedValue([
			{
				lessonId: "l1",
				lessonTitle: "Recursion basics",
				snippet: "A function that calls itself.",
			},
		]);
		const user = userEvent.setup();
		renderWithRouter(<ContentSearch scopeId="c1" fetcher={fetcher} />);

		await user.type(
			await screen.findByLabelText("Search course content"),
			"recursion",
		);

		await waitFor(() =>
			expect(screen.getByText("Recursion basics")).toBeInTheDocument(),
		);
		expect(
			screen.getByText("A function that calls itself."),
		).toBeInTheDocument();
		expect(fetcher).toHaveBeenCalledWith("recursion");
	});

	it("shows an empty state when nothing matches", async () => {
		fetcher.mockResolvedValue([]);
		const user = userEvent.setup();
		renderWithRouter(<ContentSearch scopeId="c1" fetcher={fetcher} />);

		await user.type(
			await screen.findByLabelText("Search course content"),
			"nonsense",
		);

		await waitFor(() =>
			expect(
				screen.getByText("No lessons match that yet."),
			).toBeInTheDocument(),
		);
	});

	it("clears the input with the clear button", async () => {
		fetcher.mockResolvedValue([]);
		const user = userEvent.setup();
		renderWithRouter(<ContentSearch scopeId="c1" fetcher={fetcher} />);

		const input = await screen.findByLabelText("Search course content");
		await user.type(input, "recursion");
		await user.click(screen.getByRole("button", { name: "Clear" }));

		expect(input).toHaveValue("");
	});
});
