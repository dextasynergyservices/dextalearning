// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderRoute } from "@/test/render-route";

const { resetPasswordMock, resendMock } = vi.hoisted(() => ({
	resetPasswordMock: vi.fn(),
	resendMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return {
		...actual,
		authClient: {
			emailOtp: { resetPassword: resetPasswordMock },
			forgetPassword: { emailOtp: resendMock },
		},
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
	resetPasswordMock.mockReset();
	resendMock.mockReset();
});

describe("ResetPasswordPage", () => {
	it("prompts to request a new link when no email was carried over", async () => {
		renderRoute("/reset-password");
		expect(
			await screen.findByText("This link has expired"),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Request a new link" }),
		).toBeInTheDocument();
	});

	it("renders the code + password form once an email is present", async () => {
		renderRoute("/reset-password?email=ada%40example.com");
		expect(await screen.findByText("Set a new password")).toBeInTheDocument();
		expect(screen.getByLabelText("Reset code")).toBeInTheDocument();
		expect(screen.getByLabelText("New password")).toBeInTheDocument();
	});

	it("submits the code + new password and navigates to /login on success", async () => {
		resetPasswordMock.mockImplementation((_body, { onSuccess }) => {
			onSuccess();
			return Promise.resolve();
		});
		const user = userEvent.setup();
		renderRoute("/reset-password?email=ada%40example.com");
		await screen.findByText("Set a new password");

		await user.type(screen.getByLabelText("Reset code"), "123456");
		await user.type(screen.getByLabelText("New password"), "TestPassword123!");
		await user.type(
			screen.getByLabelText("Confirm password"),
			"TestPassword123!",
		);
		await user.click(screen.getByRole("button", { name: "Update password" }));

		expect(resetPasswordMock).toHaveBeenCalledWith(
			{ email: "ada@example.com", otp: "123456", password: "TestPassword123!" },
			expect.objectContaining({ onSuccess: expect.any(Function) }),
		);
		expect(await screen.findByText("Welcome back")).toBeInTheDocument();
	});

	it("resends the code without submitting the form", async () => {
		resendMock.mockResolvedValue(undefined);
		const user = userEvent.setup();
		renderRoute("/reset-password?email=ada%40example.com");
		await screen.findByText("Set a new password");

		await user.click(screen.getByRole("button", { name: "Resend code" }));

		await waitFor(() => {
			expect(resendMock).toHaveBeenCalledWith(
				{ email: "ada@example.com" },
				expect.objectContaining({ onSuccess: expect.any(Function) }),
			);
		});
	});
});
