// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GoogleButton } from "./google-button";

describe("GoogleButton", () => {
	it("renders the given label", () => {
		render(<GoogleButton label="Continue with Google" />);
		expect(
			screen.getByRole("button", { name: "Continue with Google" }),
		).toBeInTheDocument();
	});

	it("calls onClick when clicked", async () => {
		const onClick = vi.fn();
		const user = userEvent.setup();
		render(<GoogleButton label="Continue with Google" onClick={onClick} />);

		await user.click(screen.getByRole("button"));
		expect(onClick).toHaveBeenCalledOnce();
	});

	it("is disabled when disabled is set", () => {
		render(<GoogleButton label="Continue with Google" disabled />);
		expect(screen.getByRole("button")).toBeDisabled();
	});
});
