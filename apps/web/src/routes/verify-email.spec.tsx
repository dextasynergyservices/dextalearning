// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderRoute } from "@/test/render-route";

const { verifyEmailMock, sendVerificationOtpMock } = vi.hoisted(() => ({
	verifyEmailMock: vi.fn(),
	sendVerificationOtpMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return {
		...actual,
		authClient: {
			emailOtp: {
				verifyEmail: verifyEmailMock,
				sendVerificationOtp: sendVerificationOtpMock,
			},
		},
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
	verifyEmailMock.mockReset();
	sendVerificationOtpMock.mockReset();
});

describe("VerifyEmailPage", () => {
	it("shows the email the code was sent to", async () => {
		renderRoute("/verify-email?email=ada%40example.com");
		expect(
			await screen.findByText(
				"We sent a 6-digit code and a magic link to ada@example.com. Enter the code or click the link — whichever is faster.",
			),
		).toBeInTheDocument();
	});

	it("submits the code and navigates to onboarding on success", async () => {
		verifyEmailMock.mockImplementation((_body, { onSuccess }) => {
			onSuccess();
			return Promise.resolve();
		});
		const user = userEvent.setup();
		renderRoute("/verify-email?email=ada%40example.com");
		await screen.findByText("Verify your email");

		await user.type(screen.getByLabelText("Verification code"), "654321");
		await user.click(screen.getByRole("button", { name: "Verify email" }));

		expect(verifyEmailMock).toHaveBeenCalledWith(
			{ email: "ada@example.com", otp: "654321" },
			expect.objectContaining({ onSuccess: expect.any(Function) }),
		);
	});

	it("resends the code via the Resend button", async () => {
		sendVerificationOtpMock.mockResolvedValue(undefined);
		const user = userEvent.setup();
		renderRoute("/verify-email?email=ada%40example.com");
		await screen.findByText("Verify your email");

		await user.click(screen.getByRole("button", { name: "Resend code" }));

		await waitFor(() => {
			expect(sendVerificationOtpMock).toHaveBeenCalledWith(
				{ email: "ada@example.com", type: "email-verification" },
				expect.objectContaining({ onSuccess: expect.any(Function) }),
			);
		});
	});
});
