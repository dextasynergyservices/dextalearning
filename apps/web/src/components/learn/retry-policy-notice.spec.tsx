// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProjectRetryState } from "@/lib/content-api";
import { renderWithProviders } from "@/test/render";
import { RetryPolicyNotice } from "./retry-policy-notice";

function state(overrides: Partial<ProjectRetryState> = {}): ProjectRetryState {
	return {
		attemptsUsed: 0,
		attemptsRemaining: null,
		canRetry: true,
		reason: null,
		nextAttemptAt: null,
		lockedUntil: null,
		...overrides,
	};
}

describe("RetryPolicyNotice", () => {
	it("renders nothing for an unlimited policy with nothing to report", () => {
		const { container } = renderWithProviders(
			<RetryPolicyNotice retry={state()} />,
		);
		expect(container).toBeEmptyDOMElement();
	});

	it("renders nothing once the learner has passed", () => {
		const { container } = renderWithProviders(
			<RetryPolicyNotice
				retry={state({ reason: "already_passed", canRetry: false })}
			/>,
		);
		expect(container).toBeEmptyDOMElement();
	});

	it("shows the attempts remaining when the allowance is finite", () => {
		renderWithProviders(
			<RetryPolicyNotice retry={state({ attemptsRemaining: 2 })} />,
		);
		expect(screen.getByText(/2 attempts left/i)).toBeInTheDocument();
	});

	it("shows when the next attempt unlocks during a spacing cooldown", () => {
		renderWithProviders(
			<RetryPolicyNotice
				retry={state({
					canRetry: false,
					reason: "cooldown",
					nextAttemptAt: "2026-08-01T10:00:00.000Z",
					attemptsRemaining: 2,
				})}
			/>,
		);
		expect(screen.getByRole("status")).toBeInTheDocument();
		expect(screen.getByText(/take a breather/i)).toBeInTheDocument();
		expect(screen.getByText(/you can try again from/i)).toBeInTheDocument();
	});

	it("shows the reset date when locked out after exhausting attempts", () => {
		renderWithProviders(
			<RetryPolicyNotice
				retry={state({
					canRetry: false,
					reason: "locked_out",
					lockedUntil: "2026-08-14T10:00:00.000Z",
					attemptsRemaining: 0,
				})}
			/>,
		);
		expect(screen.getByText(/used all your attempts/i)).toBeInTheDocument();
		expect(screen.getByText(/your attempts reset on/i)).toBeInTheDocument();
	});

	it("shows a terminal message when the allowance never resets", () => {
		renderWithProviders(
			<RetryPolicyNotice
				retry={state({
					canRetry: false,
					reason: "no_attempts_left",
					attemptsRemaining: 0,
				})}
			/>,
		);
		expect(screen.getByText(/no attempts left/i)).toBeInTheDocument();
	});
});
