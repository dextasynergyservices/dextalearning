// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderRoute } from "@/test/render-route";

const { registerAccountMock } = vi.hoisted(() => ({
	registerAccountMock: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/api")>();
	return { ...actual, registerAccount: registerAccountMock };
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

const validFields = {
	firstName: "Ada",
	lastName: "Lovelace",
	email: "ada@example.com",
	password: "TestPassword123!",
	confirmPassword: "TestPassword123!",
};

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
	await user.type(screen.getByLabelText("First name"), validFields.firstName);
	await user.type(screen.getByLabelText("Last name"), validFields.lastName);
	await user.type(screen.getByLabelText("Email"), validFields.email);
	await user.type(screen.getByLabelText("Password"), validFields.password);
	await user.type(
		screen.getByLabelText("Confirm password"),
		validFields.confirmPassword,
	);
}

describe("RegisterPage", () => {
	it("renders the form with learner selected by default", async () => {
		renderRoute("/register");
		expect(await screen.findByText("Create your account")).toBeInTheDocument();
		expect(
			screen.getByText("Take courses, earn certificates and Earn-Back."),
		).toBeInTheDocument();
	});

	it("switches to the instructor hint when Instructor is selected", async () => {
		const user = userEvent.setup();
		renderRoute("/register");
		await screen.findByText("Create your account");

		await user.click(screen.getByRole("button", { name: "Instructor" }));
		expect(
			screen.getByText("Create and sell courses, paths and assessments."),
		).toBeInTheDocument();
	});

	it("shows validation errors when submitting empty required fields", async () => {
		const user = userEvent.setup();
		renderRoute("/register");
		await screen.findByText("Create your account");

		await user.click(screen.getByRole("button", { name: "Create account" }));
		expect(await screen.findByText("Password must be at least 12 characters"));
		expect(registerAccountMock).not.toHaveBeenCalled();
	});

	it("registers successfully and navigates to /verify-email", async () => {
		registerAccountMock.mockResolvedValueOnce({
			userId: "u1",
			email: validFields.email,
			emailVerified: false,
		});
		const user = userEvent.setup();
		renderRoute("/register");
		await screen.findByText("Create your account");

		await fillValidForm(user);
		await user.click(screen.getByRole("button", { name: "Create account" }));

		expect(await screen.findByText("Verify your email")).toBeInTheDocument();
		expect(registerAccountMock).toHaveBeenCalledWith(
			expect.objectContaining({ email: validFields.email }),
		);
	});

	it("shows a 'sign in instead' nudge for an already-registered email, instead of a toast", async () => {
		const { ApiError } = await import("@/lib/api");
		registerAccountMock.mockRejectedValueOnce(
			new ApiError("Email already exists", "EMAIL_EXISTS"),
		);
		const user = userEvent.setup();
		renderRoute("/register");
		await screen.findByText("Create your account");

		await fillValidForm(user);
		await user.click(screen.getByRole("button", { name: "Create account" }));

		await waitFor(() => {
			expect(
				screen.getByText("This email already has an account"),
			).toBeInTheDocument();
		});
		expect(
			screen.getByRole("link", { name: "Sign in instead →" }),
		).toBeInTheDocument();
	});
});
