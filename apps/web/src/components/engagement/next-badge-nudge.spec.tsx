// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "@/test/render";
import { NextBadgeNudge } from "./next-badge-nudge";

describe("NextBadgeNudge", () => {
	it("renders nothing when every countable badge is earned", async () => {
		const { container } = renderWithRouter(<NextBadgeNudge nextBadge={null} />);
		await new Promise((r) => setTimeout(r, 0));
		expect(container.querySelector("a")).not.toBeInTheDocument();
	});

	it("shows the remaining count, badge name and progress (goal gradient)", async () => {
		renderWithRouter(
			<NextBadgeNudge
				nextBadge={{ key: "lessons_10", current: 8, target: 10 }}
			/>,
		);
		expect(await screen.findByTestId("next-badge-nudge")).toBeInTheDocument();
		expect(
			screen.getByText("2 more lessons unlock Deep Diver"),
		).toBeInTheDocument();
		expect(screen.getByText("Your next award")).toBeInTheDocument();
	});

	it("uses singular phrasing and the right metric per badge track", async () => {
		renderWithRouter(
			<NextBadgeNudge nextBadge={{ key: "streak_3", current: 2, target: 3 }} />,
		);
		expect(
			await screen.findByText("1 more day in a row unlocks Warming Up"),
		).toBeInTheDocument();
	});
});
