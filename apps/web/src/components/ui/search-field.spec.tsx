// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchField } from "./search-field";

describe("SearchField", () => {
	it("calls onChange as the user types", async () => {
		const onChange = vi.fn();
		const user = userEvent.setup();
		render(<SearchField value="" onChange={onChange} placeholder="Search" />);

		await user.type(screen.getByPlaceholderText("Search"), "a");
		expect(onChange).toHaveBeenCalledWith("a");
	});

	it("hides the clear button when empty, shows it once there's a value", () => {
		const { rerender } = render(<SearchField value="" onChange={vi.fn()} />);
		expect(
			screen.queryByRole("button", { name: "Clear search" }),
		).not.toBeInTheDocument();

		rerender(<SearchField value="course" onChange={vi.fn()} />);
		expect(
			screen.getByRole("button", { name: "Clear search" }),
		).toBeInTheDocument();
	});

	it("clears the value when the clear button is clicked", async () => {
		const onChange = vi.fn();
		const user = userEvent.setup();
		render(<SearchField value="course" onChange={onChange} />);

		await user.click(screen.getByRole("button", { name: "Clear search" }));
		expect(onChange).toHaveBeenCalledWith("");
	});
});
