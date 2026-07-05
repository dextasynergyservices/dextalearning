// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "@/test/render";
import { OnboardingShell } from "./onboarding-shell";

function baseProps(
	overrides: Partial<Parameters<typeof OnboardingShell>[0]> = {},
) {
	return {
		stepIndex: 0,
		stepCount: 4,
		asideTitle: "Let's get you set up",
		asideSubtitle: "A few quick questions.",
		canContinue: true,
		continueLabel: "Continue",
		onContinue: vi.fn(),
		children: <p>Step content</p>,
		...overrides,
	};
}

describe("OnboardingShell", () => {
	it("shows the rounded progress percentage for the current step", async () => {
		renderWithRouter(
			<OnboardingShell {...baseProps({ stepIndex: 0, stepCount: 4 })} />,
		);
		expect(await screen.findByText("25%")).toBeInTheDocument();
	});

	it("hides the back button on the first step (no onBack)", async () => {
		renderWithRouter(<OnboardingShell {...baseProps()} />);
		await screen.findByText("Step content");
		expect(
			screen.queryByRole("button", { name: "Back" }),
		).not.toBeInTheDocument();
	});

	it("shows and wires the back/skip buttons when provided", async () => {
		const onBack = vi.fn();
		const onSkip = vi.fn();
		const user = userEvent.setup();
		renderWithRouter(
			<OnboardingShell {...baseProps({ onBack, onSkip, stepIndex: 1 })} />,
		);
		await screen.findByText("Step content");

		await user.click(screen.getAllByRole("button", { name: "Back" })[0]);
		expect(onBack).toHaveBeenCalledOnce();

		await user.click(screen.getByRole("button", { name: "Skip for now" }));
		expect(onSkip).toHaveBeenCalledOnce();
	});

	it("disables Continue when canContinue is false", async () => {
		renderWithRouter(
			<OnboardingShell {...baseProps({ canContinue: false })} />,
		);
		await screen.findByText("Step content");
		expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
	});

	it("calls onContinue when enabled and clicked", async () => {
		const onContinue = vi.fn();
		const user = userEvent.setup();
		renderWithRouter(
			<OnboardingShell {...baseProps({ canContinue: true, onContinue })} />,
		);
		await screen.findByText("Step content");

		await user.click(screen.getByRole("button", { name: "Continue" }));
		expect(onContinue).toHaveBeenCalledOnce();
	});
});
