// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "./rich-text-editor";

// ProseMirror's selection sync (used by the toolbar's toggleBold/toggleItalic/
// etc. commands) relies on its own DOM observer/selection-reader machinery
// that isn't reliably drivable from jsdom — manually dispatching
// `selectionchange` after mutating window.getSelection() doesn't sync into
// the editor's internal state. Same class of limitation as the Plyr-based
// video/audio players: covered by a render smoke test, not interactive
// mark-toggling.
describe("RichTextEditor", () => {
	it("renders the initial content and toolbar buttons", async () => {
		render(<RichTextEditor value="<p>Hello world</p>" onChange={vi.fn()} />);
		expect(await screen.findByText("Hello world")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Italic" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Heading" })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Bullet list" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Numbered list" }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Quote" })).toBeInTheDocument();
	});

	it("renders empty content without crashing", async () => {
		render(<RichTextEditor value="" onChange={vi.fn()} />);
		expect(
			await screen.findByRole("button", { name: "Bold" }),
		).toBeInTheDocument();
	});
});
