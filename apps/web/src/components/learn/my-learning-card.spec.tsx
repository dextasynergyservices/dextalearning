// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MyLearningItem } from "@/lib/content-api";
import { renderWithRouter } from "@/test/render";
import { MyLearningCard } from "./my-learning-card";

function item(overrides: Partial<MyLearningItem> = {}): MyLearningItem {
	return {
		type: "course",
		id: "c1",
		title: "Intro to Testing",
		slug: "intro-to-testing",
		thumbnailUrl: null,
		isFree: true,
		isEarnBackEligible: false,
		earnBackPercentage: null,
		percent: 40,
		isComplete: false,
		...overrides,
	};
}

describe("MyLearningCard", () => {
	it("shows the title and percent-complete text", async () => {
		renderWithRouter(<MyLearningCard item={item({ percent: 40 })} />);
		expect(await screen.findByText("Intro to Testing")).toBeInTheDocument();
		expect(screen.getByText("40%")).toBeInTheDocument();
	});

	it("shows a Completed badge and 'Done' instead of a percentage once complete", async () => {
		renderWithRouter(
			<MyLearningCard item={item({ isComplete: true, percent: 100 })} />,
		);
		expect(await screen.findByText("Completed")).toBeInTheDocument();
		expect(screen.getByText("Done")).toBeInTheDocument();
		expect(screen.queryByText("100%")).not.toBeInTheDocument();
	});

	it("links to the right learner hub route per entity type", async () => {
		renderWithRouter(
			<MyLearningCard item={item({ type: "path", id: "p1" })} />,
		);
		const link = await screen.findByRole("link");
		expect(link).toHaveAttribute("href", "/learn/path/p1");
	});
});
