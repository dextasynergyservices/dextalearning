// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { EarnBackDeadlinePicker } from "./earn-back-deadline-picker";

const { setEarnBackDeadlineMock } = vi.hoisted(() => ({
	setEarnBackDeadlineMock: vi.fn(),
}));

vi.mock("@/lib/payments-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/payments-api")>();
	return { ...actual, setEarnBackDeadline: setEarnBackDeadlineMock };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("EarnBackDeadlinePicker (§4.11.1)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setEarnBackDeadlineMock.mockResolvedValue({
			deadline: "2026-08-14T00:00:00.000Z",
			days: 30,
		});
	});

	it("offers round windows, never above the frozen maximum", () => {
		renderWithProviders(
			<EarnBackDeadlinePicker type="course" entityId="c1" maxDays={30} />,
		);
		expect(screen.getByRole("button", { name: /7 days/ })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /14 days/ })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /30 days/ })).toBeInTheDocument();
		// 45 and 60 are presets, but this learner's window caps at 30.
		expect(
			screen.queryByRole("button", { name: /45 days/ }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /60 days/ }),
		).not.toBeInTheDocument();
	});

	it("always offers the maximum itself, even when it isn't a round preset", () => {
		renderWithProviders(
			<EarnBackDeadlinePicker type="course" entityId="c1" maxDays={23} />,
		);
		expect(screen.getByRole("button", { name: /23 days/ })).toBeInTheDocument();
	});

	it("collapses to a single option when the window is tiny", () => {
		renderWithProviders(
			<EarnBackDeadlinePicker type="course" entityId="c1" maxDays={5} />,
		);
		expect(screen.getByRole("button", { name: /5 days/ })).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /7 days/ }),
		).not.toBeInTheDocument();
	});

	it("commits the learner's chosen window", async () => {
		const user = userEvent.setup();
		renderWithProviders(
			<EarnBackDeadlinePicker type="course" entityId="c1" maxDays={60} />,
		);

		await user.click(screen.getByRole("button", { name: /14 days/ }));
		await user.click(screen.getByRole("button", { name: /Commit to/ }));

		await waitFor(() => {
			expect(setEarnBackDeadlineMock).toHaveBeenCalledWith("course", "c1", 14);
		});
	});

	it("warns that the choice is final before it's made", () => {
		renderWithProviders(
			<EarnBackDeadlinePicker type="course" entityId="c1" maxDays={60} />,
		);
		expect(screen.getByText(/can't change it later/i)).toBeInTheDocument();
	});

	it("names the amount at stake when it's known", () => {
		renderWithProviders(
			<EarnBackDeadlinePicker
				type="course"
				entityId="c1"
				maxDays={60}
				base={4750}
				currency="NGN"
			/>,
		);
		expect(screen.getByText(/back to your card/i)).toBeInTheDocument();
	});

	it("calls onDone once committed, so the host can move on", async () => {
		const onDone = vi.fn();
		const user = userEvent.setup();
		renderWithProviders(
			<EarnBackDeadlinePicker
				type="course"
				entityId="c1"
				maxDays={60}
				onDone={onDone}
			/>,
		);

		await user.click(screen.getByRole("button", { name: /Commit to/ }));
		await waitFor(() => {
			expect(onDone).toHaveBeenCalled();
		});
	});
});
