// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { AtRiskPill, RiskBadge } from "./risk-badge";

describe("RiskBadge", () => {
	it("shows inactive days for a flagged learner", () => {
		renderWithProviders(
			<RiskBadge
				risk={{ level: "high", reasons: ["inactive_14d"], daysInactive: 20 }}
			/>,
		);
		expect(screen.getByText("Inactive 20d")).toBeInTheDocument();
	});

	it("surfaces the reason as a tooltip", () => {
		renderWithProviders(
			<RiskBadge
				risk={{ level: "medium", reasons: ["never_started"], daysInactive: 8 }}
			/>,
		);
		expect(screen.getByText("Inactive 8d")).toHaveAttribute(
			"title",
			"Hasn't started",
		);
	});
});

describe("AtRiskPill", () => {
	it("renders a count", () => {
		renderWithProviders(<AtRiskPill count={3} />);
		expect(screen.getByText("3 at risk")).toBeInTheDocument();
	});

	it("renders nothing at zero", () => {
		const { container } = renderWithProviders(<AtRiskPill count={0} />);
		expect(container).toBeEmptyDOMElement();
	});
});
