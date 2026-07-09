// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { SocialProofLine } from "./social-proof-line";

describe("SocialProofLine", () => {
	it("renders nothing when both counters are zero — no empty proof", () => {
		const { container } = renderWithProviders(
			<SocialProofLine enrolled={0} completedThisWeek={0} />,
		);
		expect(container).toBeEmptyDOMElement();
	});

	it("shows the enrolled counter", () => {
		renderWithProviders(<SocialProofLine enrolled={47} />);
		expect(screen.getByText("47 enrolled")).toBeInTheDocument();
	});

	it("shows both counters together", () => {
		renderWithProviders(
			<SocialProofLine enrolled={12} completedThisWeek={5} />,
		);
		expect(screen.getByText("12 enrolled")).toBeInTheDocument();
		expect(screen.getByText("5 completed this week")).toBeInTheDocument();
	});

	it("hides only the zero counter when the other has proof", () => {
		renderWithProviders(<SocialProofLine enrolled={0} completedThisWeek={3} />);
		expect(screen.queryByText(/enrolled/)).not.toBeInTheDocument();
		expect(screen.getByText("3 completed this week")).toBeInTheDocument();
	});
});
