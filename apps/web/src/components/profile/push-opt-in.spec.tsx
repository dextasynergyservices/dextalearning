// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { PushOptIn } from "./push-opt-in";

const {
	isPushSupportedMock,
	pushPermissionMock,
	isPushEnabledMock,
	enablePushMock,
	disablePushMock,
} = vi.hoisted(() => ({
	isPushSupportedMock: vi.fn(),
	pushPermissionMock: vi.fn(),
	isPushEnabledMock: vi.fn(),
	enablePushMock: vi.fn(),
	disablePushMock: vi.fn(),
}));

vi.mock("@/lib/push", () => ({
	isPushSupported: isPushSupportedMock,
	pushPermission: pushPermissionMock,
	isPushEnabled: isPushEnabledMock,
	enablePush: enablePushMock,
	disablePush: disablePushMock,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("PushOptIn", () => {
	beforeEach(() => {
		isPushSupportedMock.mockReset().mockReturnValue(true);
		pushPermissionMock.mockReset().mockReturnValue("default");
		isPushEnabledMock.mockReset().mockResolvedValue(false);
		enablePushMock.mockReset().mockResolvedValue(true);
		disablePushMock.mockReset().mockResolvedValue(undefined);
	});

	it("enables push when the toggle is switched on", async () => {
		const user = userEvent.setup();
		renderWithProviders(<PushOptIn />);
		const toggle = screen.getByRole("switch", { name: "Push notifications" });
		expect(toggle).toHaveAttribute("aria-checked", "false");

		await user.click(toggle);
		expect(enablePushMock).toHaveBeenCalled();
		await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
	});

	it("reflects an already-subscribed browser and can disable", async () => {
		isPushEnabledMock.mockResolvedValue(true);
		const user = userEvent.setup();
		renderWithProviders(<PushOptIn />);
		const toggle = await screen.findByRole("switch", {
			name: "Push notifications",
		});
		await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));

		await user.click(toggle);
		expect(disablePushMock).toHaveBeenCalled();
		await waitFor(() =>
			expect(toggle).toHaveAttribute("aria-checked", "false"),
		);
	});

	it("hides the toggle and explains when the browser doesn't support push", () => {
		isPushSupportedMock.mockReturnValue(false);
		pushPermissionMock.mockReturnValue("unsupported");
		renderWithProviders(<PushOptIn />);
		expect(screen.queryByRole("switch")).not.toBeInTheDocument();
		expect(
			screen.getByText("Push isn't supported on this browser."),
		).toBeInTheDocument();
	});

	it("shows a hint and disables the toggle when notifications are blocked", () => {
		pushPermissionMock.mockReturnValue("denied");
		renderWithProviders(<PushOptIn />);
		expect(
			screen.getByRole("switch", { name: "Push notifications" }),
		).toBeDisabled();
		expect(screen.getByText(/Notifications are blocked/i)).toBeInTheDocument();
	});
});
