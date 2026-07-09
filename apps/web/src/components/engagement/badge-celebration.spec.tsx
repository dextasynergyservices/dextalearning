// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { BadgeCelebration } from "./badge-celebration";

const { getEngagementMeMock, markBadgesSeenMock } = vi.hoisted(() => ({
	getEngagementMeMock: vi.fn(),
	markBadgesSeenMock: vi.fn(),
}));

vi.mock("@/lib/engagement-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/engagement-api")>();
	return {
		...actual,
		getEngagementMe: getEngagementMeMock,
		markBadgesSeen: markBadgesSeenMock,
	};
});

function me(unseenBadgeKeys: string[]) {
	return {
		streak: {
			current: 1,
			longest: 1,
			freezes: 0,
			lastActiveDate: "2026-07-06",
			atRisk: false,
			todayDone: true,
		},
		weekActivity: [],
		badges: unseenBadgeKeys.map((key) => ({
			key,
			awardedAt: new Date().toISOString(),
			seen: false,
		})),
		unseenBadgeKeys,
		allBadgeKeys: ["first_lesson", "perfect_quiz"],
	};
}

describe("BadgeCelebration", () => {
	beforeEach(() => {
		getEngagementMeMock.mockReset();
		markBadgesSeenMock.mockReset();
		markBadgesSeenMock.mockResolvedValue({ ok: true });
	});

	it("renders nothing when there are no unseen badges", async () => {
		getEngagementMeMock.mockResolvedValue(me([]));
		renderWithProviders(<BadgeCelebration />);
		await waitFor(() => expect(getEngagementMeMock).toHaveBeenCalled());
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("celebrates an unseen badge and marks it seen on dismiss", async () => {
		getEngagementMeMock.mockResolvedValue(me(["first_lesson"]));
		const user = userEvent.setup();
		renderWithProviders(<BadgeCelebration />);

		expect(await screen.findByRole("dialog")).toBeInTheDocument();
		expect(screen.getByText("First Steps")).toBeInTheDocument();
		expect(screen.getByText("Award unlocked!")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Keep going" }));
		// TanStack Query passes a context object as the 2nd mutationFn arg.
		expect(markBadgesSeenMock.mock.calls[0][0]).toEqual(["first_lesson"]);
		await waitFor(() => {
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		});
	});

	it("plays multiple unseen badges sequentially", async () => {
		getEngagementMeMock.mockResolvedValue(me(["first_lesson", "perfect_quiz"]));
		const user = userEvent.setup();
		renderWithProviders(<BadgeCelebration />);

		expect(await screen.findByText("First Steps")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Next award" }));

		expect(await screen.findByText("Perfect Score")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Keep going" }));
		expect(markBadgesSeenMock).toHaveBeenCalledTimes(2);
	});
});
