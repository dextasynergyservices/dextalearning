// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagInput } from "./tag-input";

describe("TagInput", () => {
	it("adds a tag on Enter and clears the draft", async () => {
		const onChange = vi.fn();
		const user = userEvent.setup();
		render(<TagInput value={[]} onChange={onChange} placeholder="Add a tag" />);

		const input = screen.getByPlaceholderText("Add a tag");
		await user.type(input, "javascript{Enter}");
		expect(onChange).toHaveBeenCalledWith(["javascript"]);
	});

	it("adds a tag on comma", async () => {
		const onChange = vi.fn();
		const user = userEvent.setup();
		render(<TagInput value={[]} onChange={onChange} />);

		await user.type(screen.getByRole("textbox"), "nodejs,");
		expect(onChange).toHaveBeenCalledWith(["nodejs"]);
	});

	it("does not add a duplicate tag (case-insensitive)", async () => {
		const onChange = vi.fn();
		const user = userEvent.setup();
		render(<TagInput value={["React"]} onChange={onChange} />);

		await user.type(screen.getByRole("textbox"), "react{Enter}");
		expect(onChange).not.toHaveBeenCalled();
	});

	it("refuses to add beyond maxTags", async () => {
		const onChange = vi.fn();
		const user = userEvent.setup();
		render(<TagInput value={["a", "b"]} onChange={onChange} maxTags={2} />);

		await user.type(screen.getByRole("textbox"), "c{Enter}");
		expect(onChange).not.toHaveBeenCalled();
	});

	it("removes the last tag on Backspace when the draft is empty", async () => {
		const onChange = vi.fn();
		const user = userEvent.setup();
		render(<TagInput value={["a", "b"]} onChange={onChange} />);

		await user.type(screen.getByRole("textbox"), "{Backspace}");
		expect(onChange).toHaveBeenCalledWith(["a"]);
	});

	it("removes a tag when its remove button is clicked", async () => {
		const onChange = vi.fn();
		const user = userEvent.setup();
		render(<TagInput value={["a", "b"]} onChange={onChange} />);

		const removeButtons = screen.getAllByRole("button", { name: "Remove" });
		await user.click(removeButtons[0]);
		expect(onChange).toHaveBeenCalledWith(["b"]);
	});

	it("adds a tag by clicking a suggestion chip, and hides consumed suggestions", async () => {
		const onChange = vi.fn();
		const user = userEvent.setup();
		render(
			<TagInput
				value={[]}
				onChange={onChange}
				suggestions={[{ value: "css", label: "CSS" }]}
			/>,
		);

		await user.click(screen.getByRole("button", { name: "+ CSS" }));
		expect(onChange).toHaveBeenCalledWith(["css"]);
	});
});
