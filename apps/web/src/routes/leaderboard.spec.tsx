// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Leaderboard } from "@/lib/leaderboard-api";
import { renderRoute } from "@/test/render-route";

const {
	useSessionMock,
	getLeaderboardMock,
	getEngagementMeMock,
	getMyFacilitatedCohortsMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getLeaderboardMock: vi.fn(),
	getEngagementMeMock: vi.fn(),
	getMyFacilitatedCohortsMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/facilitator-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/facilitator-api")>();
	return { ...actual, getMyFacilitatedCohorts: getMyFacilitatedCohortsMock };
});

vi.mock("@/lib/leaderboard-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/leaderboard-api")>();
	return { ...actual, getLeaderboard: getLeaderboardMock };
});

vi.mock("@/lib/engagement-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/engagement-api")>();
	return { ...actual, getEngagementMe: getEngagementMeMock };
});

function board(overrides: Partial<Leaderboard> = {}): Leaderboard {
	return {
		type: "overall",
		period: "all_time",
		cohortId: null,
		kind: "user",
		total: 4,
		entries: [
			{
				rank: 1,
				score: 300,
				subjectId: "a",
				name: "Amara Okafor",
				isSelf: false,
			},
			{ rank: 2, score: 200, subjectId: "b", name: "Wei Chen", isSelf: false },
			{
				rank: 3,
				score: 150,
				subjectId: "c",
				name: "Sofia Reyes",
				isSelf: false,
			},
			{
				rank: 4,
				score: 90,
				subjectId: "u1",
				name: "Ada Lovelace",
				isSelf: true,
			},
		],
		me: {
			rank: 4,
			score: 90,
			subjectId: "u1",
			name: "Ada Lovelace",
			isSelf: true,
		},
		...overrides,
	};
}

describe("Leaderboard page", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getLeaderboardMock.mockReset();
		getEngagementMeMock.mockReset();
		getMyFacilitatedCohortsMock.mockReset().mockResolvedValue([]);
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "learner" } },
			isPending: false,
		});
		getLeaderboardMock.mockResolvedValue(board());
		getEngagementMeMock.mockResolvedValue({
			streak: {
				current: 2,
				longest: 4,
				freezes: 0,
				lastActiveDate: null,
				atRisk: false,
				todayDone: false,
			},
			weekActivity: [],
			badges: [
				{ key: "first_lesson", awardedAt: "2026-07-01T09:00:00Z", seen: true },
			],
			unseenBadgeKeys: [],
			allBadgeKeys: ["first_lesson", "lessons_10"],
		});
	});

	it("renders the live podium, the ranked list, and the caller's own position", async () => {
		renderRoute("/leaderboard");

		expect(await screen.findByText("Amara Okafor")).toBeInTheDocument();
		expect(screen.getByText("300")).toBeInTheDocument();
		expect(screen.getByText("Your position")).toBeInTheDocument();
		// The signed-in learner is labelled "You", not their real name.
		expect(screen.getAllByText("You").length).toBeGreaterThan(0);
	});

	it("shows the Facilitator tab in the bottom nav only when the user facilitates a cohort", async () => {
		getMyFacilitatedCohortsMock.mockResolvedValue([]);
		const { unmount } = renderRoute("/leaderboard");
		await screen.findByText("Amara Okafor");
		expect(screen.queryByText("Facilitate")).not.toBeInTheDocument();
		unmount();

		getMyFacilitatedCohortsMock.mockResolvedValue([
			{
				id: "c1",
				title: "Cohort One",
				slug: "c1",
				status: "open",
				startsAt: null,
				groupingMode: "manual",
				learnerCount: 5,
				groupCount: 2,
			},
		]);
		renderRoute("/leaderboard");
		expect(await screen.findByText("Facilitate")).toBeInTheDocument();
	});

	it("keeps the Phase 4 'Your awards' badge grid above the board", async () => {
		renderRoute("/leaderboard");

		expect(await screen.findByTestId("badge-grid")).toBeInTheDocument();
		expect(screen.getByText("1 of 2 earned")).toBeInTheDocument();
	});

	it("refetches when switching type and period", async () => {
		const user = userEvent.setup();
		renderRoute("/leaderboard");
		await screen.findByText("Amara Okafor");

		await user.click(screen.getByRole("button", { name: /Peer helper/i }));
		await waitFor(() =>
			expect(getLeaderboardMock).toHaveBeenCalledWith(
				expect.objectContaining({ type: "peer", period: "all_time" }),
			),
		);

		await user.click(screen.getByRole("button", { name: "This week" }));
		await waitFor(() =>
			expect(getLeaderboardMock).toHaveBeenCalledWith(
				expect.objectContaining({ period: "weekly" }),
			),
		);
	});

	it("shows an empty state when there are no rankings", async () => {
		getLeaderboardMock.mockResolvedValue(
			board({ entries: [], me: null, total: 0 }),
		);
		renderRoute("/leaderboard");

		expect(
			await screen.findByText("The leaderboard is warming up"),
		).toBeInTheDocument();
	});
});
