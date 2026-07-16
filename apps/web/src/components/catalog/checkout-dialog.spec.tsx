// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { type CheckoutCommercials, CheckoutDialog } from "./checkout-dialog";

const { getPaymentMethodsMock, getPlatformFeePctMock, startCheckoutMock } =
	vi.hoisted(() => ({
		getPaymentMethodsMock: vi.fn(),
		getPlatformFeePctMock: vi.fn(),
		startCheckoutMock: vi.fn(),
	}));

vi.mock("@/lib/payments-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/payments-api")>();
	return {
		...actual,
		getPaymentMethods: getPaymentMethodsMock,
		getPlatformFeePct: getPlatformFeePctMock,
		startCheckout: startCheckoutMock,
	};
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function commercials(
	overrides: Partial<CheckoutCommercials> = {},
): CheckoutCommercials {
	return {
		title: "Intro to Systems",
		price: 10000,
		currency: "NGN",
		isFree: false,
		isEarnBackEligible: false,
		earnBackPercentage: null,
		earnBackDeadlineDays: null,
		...overrides,
	};
}

function open() {
	renderWithProviders(
		<CheckoutDialog
			open
			onOpenChange={vi.fn()}
			type="course"
			id="c1"
			commercials={commercials()}
		/>,
	);
}

describe("CheckoutDialog — payment method picker (§14.1)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getPlatformFeePctMock.mockResolvedValue({ pct: 5 });
		startCheckoutMock.mockResolvedValue({
			authorizationUrl: "https://pay.example/x",
			orderId: "o1",
		});
	});

	it("preselects the provider the server recommends for the currency", async () => {
		getPaymentMethodsMock.mockResolvedValue({
			providers: ["paystack", "stripe"],
			recommended: "paystack",
		});
		open();

		// NGN → the server recommends Paystack; we don't re-derive that here.
		const paystack = await screen.findByRole("button", { name: /Paystack/ });
		await waitFor(() => {
			expect(paystack).toHaveAttribute("aria-pressed", "true");
		});
		expect(screen.getByRole("button", { name: /Stripe/ })).toHaveAttribute(
			"aria-pressed",
			"false",
		);
	});

	it("sends the learner's chosen provider to checkout", async () => {
		getPaymentMethodsMock.mockResolvedValue({
			providers: ["paystack", "stripe"],
			recommended: "paystack",
		});
		const user = userEvent.setup();
		open();

		await user.click(await screen.findByRole("button", { name: /Stripe/ }));
		await user.click(
			screen.getByRole("button", { name: /Proceed to payment/ }),
		);

		await waitFor(() => {
			expect(startCheckoutMock).toHaveBeenCalledWith("course", "c1", "stripe");
		});
	});

	it("hides the picker when Admin offers only one method — no choice to make", async () => {
		getPaymentMethodsMock.mockResolvedValue({
			providers: ["paystack"],
			recommended: "paystack",
		});
		open();

		expect(
			await screen.findByRole("button", { name: /Proceed to payment/ }),
		).toBeInTheDocument();
		expect(
			screen.queryByText("How would you like to pay?"),
		).not.toBeInTheDocument();
	});

	it("credits only the methods actually offered in the footer", async () => {
		getPaymentMethodsMock.mockResolvedValue({
			providers: ["paystack"],
			recommended: "paystack",
		});
		open();

		expect(
			await screen.findByText("Secure payment via Paystack"),
		).toBeInTheDocument();
	});
});
