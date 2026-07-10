// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { renderWithProviders } from "@/test/render";
import { PhoneVerifyDialog } from "./phone-verify-dialog";

const { sendPhoneCodeMock, verifyPhoneCodeMock } = vi.hoisted(() => ({
	sendPhoneCodeMock: vi.fn(),
	verifyPhoneCodeMock: vi.fn(),
}));

vi.mock("@/lib/phone-verification-api", () => ({
	sendPhoneCode: sendPhoneCodeMock,
	verifyPhoneCode: verifyPhoneCodeMock,
}));

// framer-motion's drag machinery isn't needed in jsdom; keep it lightweight but
// preserve real behaviour by using the actual module (it renders fine here).

function setup(
	overrides: Partial<Parameters<typeof PhoneVerifyDialog>[0]> = {},
) {
	const onOpenChange = vi.fn();
	const onVerified = vi.fn();
	renderWithProviders(
		<PhoneVerifyDialog
			open
			phone="+2348001234567"
			onOpenChange={onOpenChange}
			onVerified={onVerified}
			{...overrides}
		/>,
	);
	return { onOpenChange, onVerified };
}

describe("PhoneVerifyDialog", () => {
	beforeEach(() => {
		sendPhoneCodeMock.mockReset();
		verifyPhoneCodeMock.mockReset();
	});

	it("sends over WhatsApp, accepts the code, and reports verification", async () => {
		sendPhoneCodeMock.mockResolvedValue({
			status: "sent",
			channel: "whatsapp",
			resendInSeconds: 60,
		});
		verifyPhoneCodeMock.mockResolvedValue({ status: "verified" });
		const user = userEvent.setup();
		const { onVerified } = setup();

		await user.click(
			screen.getByRole("button", { name: "Send code on WhatsApp" }),
		);
		expect(sendPhoneCodeMock).toHaveBeenCalledWith("whatsapp");

		// Now on the code stage — type the 6 digits into the segmented input.
		const cells = await screen.findAllByLabelText(/Digit \d of 6/);
		expect(cells).toHaveLength(6);
		await user.type(cells[0], "123456");

		// Auto-submits on the 6th digit.
		await waitFor(() =>
			expect(verifyPhoneCodeMock).toHaveBeenCalledWith("123456"),
		);

		// Success stage → Done fires onVerified + closes.
		await user.click(await screen.findByRole("button", { name: "Done" }));
		expect(onVerified).toHaveBeenCalled();
	});

	it("can send by SMS instead", async () => {
		sendPhoneCodeMock.mockResolvedValue({ status: "sent", channel: "sms" });
		const user = userEvent.setup();
		setup();

		await user.click(screen.getByRole("button", { name: "Send code by SMS" }));
		expect(sendPhoneCodeMock).toHaveBeenCalledWith("sms");
		// The SMS "code sent" copy appears.
		expect(await screen.findByText(/sent a code by SMS/i)).toBeInTheDocument();
	});

	it("surfaces a wrong-code error and leaves the dialog on the code stage", async () => {
		sendPhoneCodeMock.mockResolvedValue({
			status: "sent",
			channel: "whatsapp",
		});
		verifyPhoneCodeMock.mockRejectedValue(
			new ApiError(
				"Incorrect code. Please check and try again.",
				"INVALID_CODE",
			),
		);
		const user = userEvent.setup();
		const { onVerified } = setup();

		await user.click(
			screen.getByRole("button", { name: "Send code on WhatsApp" }),
		);
		const cells = await screen.findAllByLabelText(/Digit \d of 6/);
		await user.type(cells[0], "000000");

		expect(await screen.findByText(/Incorrect code/i)).toBeInTheDocument();
		expect(onVerified).not.toHaveBeenCalled();
	});
});
