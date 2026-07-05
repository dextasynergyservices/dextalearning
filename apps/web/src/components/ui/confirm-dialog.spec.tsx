// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";

function baseProps(
	overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {},
) {
	return {
		open: true,
		title: "Delete course?",
		description: "This cannot be undone.",
		confirmLabel: "Delete",
		cancelLabel: "Cancel",
		onConfirm: vi.fn(),
		onOpenChange: vi.fn(),
		...overrides,
	};
}

describe("ConfirmDialog", () => {
	it("renders nothing when closed", () => {
		render(<ConfirmDialog {...baseProps({ open: false })} />);
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("renders the title and description when open", () => {
		render(<ConfirmDialog {...baseProps()} />);
		expect(screen.getByText("Delete course?")).toBeInTheDocument();
		expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
	});

	it("calls onConfirm when the confirm button is clicked", async () => {
		const onConfirm = vi.fn();
		const user = userEvent.setup();
		render(<ConfirmDialog {...baseProps({ onConfirm })} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));
		expect(onConfirm).toHaveBeenCalledOnce();
	});

	it("calls onOpenChange(false) on Escape", async () => {
		const onOpenChange = vi.fn();
		const user = userEvent.setup();
		render(<ConfirmDialog {...baseProps({ onOpenChange })} />);

		await user.keyboard("{Escape}");
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("does not close on Escape while a confirm action is pending", async () => {
		const onOpenChange = vi.fn();
		const user = userEvent.setup();
		render(<ConfirmDialog {...baseProps({ onOpenChange, isPending: true })} />);

		await user.keyboard("{Escape}");
		expect(onOpenChange).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
	});
});
