// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { CommercialBadge } from "./commercial-badge";

describe("CommercialBadge", () => {
	it("shows a plain Earn-Back badge at 100%", () => {
		renderWithProviders(
			<CommercialBadge
				isFree={false}
				isEarnBackEligible={true}
				earnBackPercentage={100}
			/>,
		);
		expect(screen.getByText("Earn-Back")).toBeInTheDocument();
	});

	it("shows the percentage when Earn-Back is below 100%", () => {
		renderWithProviders(
			<CommercialBadge
				isFree={false}
				isEarnBackEligible={true}
				earnBackPercentage={60}
			/>,
		);
		expect(screen.getByText("60% Earn-Back")).toBeInTheDocument();
	});

	it("shows a Free badge for free, non-Earn-Back content", () => {
		renderWithProviders(
			<CommercialBadge
				isFree={true}
				isEarnBackEligible={false}
				earnBackPercentage={null}
			/>,
		);
		expect(screen.getByText("Free")).toBeInTheDocument();
	});

	it("renders nothing for paid content without Earn-Back", () => {
		const { container } = renderWithProviders(
			<CommercialBadge
				isFree={false}
				isEarnBackEligible={false}
				earnBackPercentage={null}
			/>,
		);
		expect(container).toBeEmptyDOMElement();
	});

	it("prefers Earn-Back over Free when both are true", () => {
		renderWithProviders(
			<CommercialBadge
				isFree={true}
				isEarnBackEligible={true}
				earnBackPercentage={100}
			/>,
		);
		expect(screen.getByText("Earn-Back")).toBeInTheDocument();
		expect(screen.queryByText("Free")).not.toBeInTheDocument();
	});
});
