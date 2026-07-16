// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentSettingsResponse } from "@/lib/admin-settings-api";
import { renderRoute } from "@/test/render-route";

const { getPaymentSettingsMock, updatePaymentProvidersMock, useSessionMock } =
	vi.hoisted(() => ({
		getPaymentSettingsMock: vi.fn(),
		updatePaymentProvidersMock: vi.fn(),
		useSessionMock: vi.fn(),
	}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/admin-settings-api", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/admin-settings-api")>();
	return {
		...actual,
		getPaymentSettings: getPaymentSettingsMock,
		updatePaymentProviders: updatePaymentProvidersMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function settings(
	overrides: Partial<PaymentSettingsResponse> = {},
): PaymentSettingsResponse {
	return {
		settings: [
			{ key: "platform_fee_pct", value: 5, min: 0, max: 30 },
			{ key: "instructor_revenue_share_pct", value: 90, min: 0, max: 100 },
		],
		providers: ["paystack", "stripe"],
		allProviders: ["paystack", "stripe"],
		...overrides,
	};
}

describe("AdminSettingsPage — payment methods (§14.1)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "admin" } },
			isPending: false,
		});
	});

	it("lists every payment method the platform supports", async () => {
		getPaymentSettingsMock.mockResolvedValue(settings());
		renderRoute("/admin/settings");
		expect(await screen.findByText("Payment methods")).toBeInTheDocument();
		expect(screen.getByText("Paystack")).toBeInTheDocument();
		expect(screen.getByText("Stripe")).toBeInTheDocument();
	});

	it("switches a method off", async () => {
		getPaymentSettingsMock.mockResolvedValue(settings());
		updatePaymentProvidersMock.mockResolvedValue({ providers: ["paystack"] });
		const user = userEvent.setup();
		renderRoute("/admin/settings");
		await screen.findByText("Payment methods");

		await user.click(screen.getByRole("button", { name: /Stripe/ }));
		await waitFor(() => {
			expect(updatePaymentProvidersMock).toHaveBeenCalledWith(["paystack"]);
		});
	});

	it("won't let the last remaining method be switched off", async () => {
		getPaymentSettingsMock.mockResolvedValue(
			settings({ providers: ["paystack"] }),
		);
		const user = userEvent.setup();
		renderRoute("/admin/settings");
		await screen.findByText("Payment methods");

		const paystack = screen.getByRole("button", { name: /Paystack/ });
		expect(paystack).toBeDisabled();
		await user.click(paystack);
		expect(updatePaymentProvidersMock).not.toHaveBeenCalled();
	});
});
