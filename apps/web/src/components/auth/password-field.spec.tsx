// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { PasswordField } from "./password-field";

describe("PasswordField", () => {
	it("renders the label and hint", () => {
		renderWithProviders(
			<PasswordField
				label="Password"
				hint="At least 12 characters."
				name="password"
			/>,
		);
		expect(screen.getByText("Password")).toBeInTheDocument();
		expect(screen.getByText("At least 12 characters.")).toBeInTheDocument();
	});

	it("shows the error message instead of the hint when both are set", () => {
		renderWithProviders(
			<PasswordField
				label="Password"
				hint="At least 12 characters."
				error="Password is too short"
				name="password"
			/>,
		);
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Password is too short",
		);
		expect(
			screen.queryByText("At least 12 characters."),
		).not.toBeInTheDocument();
	});

	it("toggles visibility when the eye button is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<PasswordField label="Password" name="password" />);

		const input = screen.getByLabelText("Password");
		expect(input).toHaveAttribute("type", "password");

		const toggle = screen.getByRole("button", { name: "Show password" });
		await user.click(toggle);

		expect(input).toHaveAttribute("type", "text");
		expect(
			screen.getByRole("button", { name: "Hide password" }),
		).toBeInTheDocument();
	});
});
