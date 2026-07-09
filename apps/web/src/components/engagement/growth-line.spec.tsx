// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { GrowthLine } from "./growth-line";

describe("GrowthLine", () => {
	it("frames pre→post growth first when the post-quiz beats the pre-quiz", () => {
		renderWithProviders(
			<GrowthLine
				score={80}
				previousBest={null}
				delta={null}
				preQuizBest={40}
			/>,
		);
		expect(
			screen.getByText("You went from 40% to 80% — that's real growth!"),
		).toBeInTheDocument();
	});

	it("frames improvement over the previous best on a retry", () => {
		renderWithProviders(<GrowthLine score={75} previousBest={50} delta={25} />);
		expect(
			screen.getByText("You've grown +25% since your last attempt!"),
		).toBeInTheDocument();
	});

	it("frames a first attempt as the baseline — never a bare grade", () => {
		renderWithProviders(
			<GrowthLine score={60} previousBest={null} delta={null} />,
		);
		expect(
			screen.getByText(/You scored 60% — that's your baseline/),
		).toBeInTheDocument();
	});

	it("stays positive when the score didn't beat the best (retrieval framing)", () => {
		renderWithProviders(
			<GrowthLine score={40} previousBest={70} delta={-30} />,
		);
		expect(screen.getByText(/Your best is still 70%/)).toBeInTheDocument();
	});
});
