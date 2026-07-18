// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { TwoFactorSection } from "./two-factor-section";

const { enableMock, disableMock, verifyTotpMock, regenMock } = vi.hoisted(
	() => ({
		enableMock: vi.fn(),
		disableMock: vi.fn(),
		verifyTotpMock: vi.fn(),
		regenMock: vi.fn(),
	}),
);

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		twoFactor: {
			enable: enableMock,
			disable: disableMock,
			verifyTotp: verifyTotpMock,
			generateBackupCodes: regenMock,
		},
	},
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Dynamic-imported QR renderer — stub so jsdom doesn't run the encoder.
vi.mock("qrcode", () => ({
	toDataURL: vi.fn(async () => "data:image/png;base64,x"),
}));

const TOTP_URI =
	"otpauth://totp/DextaLearning:me@x.com?secret=ABC123&issuer=DextaLearning";

describe("TwoFactorSection", () => {
	beforeEach(() => {
		enableMock.mockReset().mockResolvedValue({
			data: { totpURI: TOTP_URI, backupCodes: ["aaaa-bbbb", "cccc-dddd"] },
			error: null,
		});
		disableMock
			.mockReset()
			.mockResolvedValue({ data: { status: true }, error: null });
		verifyTotpMock.mockReset().mockResolvedValue({ data: {}, error: null });
		regenMock.mockReset();
	});

	it("walks enable: password → QR + manual key + backup codes", async () => {
		const user = userEvent.setup();
		const onChanged = vi.fn();
		renderWithProviders(
			<TwoFactorSection enabled={false} onChanged={onChanged} />,
		);

		expect(screen.getByText("Off")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /turn on/i }));

		await user.type(screen.getByLabelText("Password"), "hunter2hunter2");
		// The password step's own submit button also reads "Turn on".
		const buttons = screen.getAllByRole("button", { name: /turn on/i });
		await user.click(buttons[buttons.length - 1]);

		expect(enableMock).toHaveBeenCalledWith({ password: "hunter2hunter2" });
		// Manual key (the otpauth secret) is shown for apps that can't scan.
		await waitFor(() => expect(screen.getByText("ABC123")).toBeInTheDocument());
		expect(screen.getByRole("img")).toHaveAttribute(
			"src",
			"data:image/png;base64,x",
		);
	});

	it("requires a password before enabling", async () => {
		const { toast } = await import("sonner");
		const user = userEvent.setup();
		renderWithProviders(
			<TwoFactorSection enabled={false} onChanged={vi.fn()} />,
		);
		await user.click(screen.getByRole("button", { name: /turn on/i }));
		const buttons = screen.getAllByRole("button", { name: /turn on/i });
		await user.click(buttons[buttons.length - 1]);
		expect(enableMock).not.toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalled();
	});

	it("disables when already enabled after password confirm", async () => {
		const user = userEvent.setup();
		const onChanged = vi.fn();
		renderWithProviders(<TwoFactorSection enabled onChanged={onChanged} />);

		expect(screen.getByText("On")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /turn off/i }));
		await user.type(screen.getByLabelText("Password"), "hunter2hunter2");
		const offButtons = screen.getAllByRole("button", { name: /turn off/i });
		await user.click(offButtons[offButtons.length - 1]);

		expect(disableMock).toHaveBeenCalledWith({ password: "hunter2hunter2" });
		await waitFor(() => expect(onChanged).toHaveBeenCalled());
	});
});
