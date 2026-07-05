// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderRoute } from "@/test/render-route";

const { emailOtpMock } = vi.hoisted(() => ({ emailOtpMock: vi.fn() }));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return {
		...actual,
		authClient: { forgetPassword: { emailOtp: emailOtpMock } },
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
	emailOtpMock.mockReset();
});

describe("ForgotPasswordPage", () => {
	it("renders the form", async () => {
		renderRoute("/forgot-password");
		expect(await screen.findByText("Reset your password")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Back to sign in" }),
		).toBeInTheDocument();
	});

	it("requests an OTP and navigates to /reset-password with the email carried over", async () => {
		emailOtpMock.mockImplementation((_body, { onSuccess }) => {
			onSuccess();
			return Promise.resolve();
		});
		const user = userEvent.setup();
		renderRoute("/forgot-password");
		await screen.findByText("Reset your password");

		await user.type(screen.getByLabelText("Email"), "ada@example.com");
		await user.click(screen.getByRole("button", { name: "Send reset link" }));

		expect(emailOtpMock).toHaveBeenCalledWith(
			{ email: "ada@example.com" },
			expect.objectContaining({ onSuccess: expect.any(Function) }),
		);
		// Successful navigation lands on the reset-password form, which reads
		// the email back out of the search params.
		expect(
			await screen.findByText("Set a new password", undefined, {
				timeout: 3000,
			}),
		).toBeInTheDocument();
	});

	it("shows an error toast when the request fails", async () => {
		const { toast } = await import("sonner");
		emailOtpMock.mockImplementation((_body, { onError }) => {
			onError({ error: { message: "No account with that email" } });
			return Promise.resolve();
		});
		const user = userEvent.setup();
		renderRoute("/forgot-password");
		await screen.findByText("Reset your password");

		await user.type(screen.getByLabelText("Email"), "nope@example.com");
		await user.click(screen.getByRole("button", { name: "Send reset link" }));

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith("No account with that email");
		});
	});
});
