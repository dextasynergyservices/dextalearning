// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, getMyProfileMock, getEngagementMeMock } = vi.hoisted(
	() => ({
		useSessionMock: vi.fn(),
		getMyProfileMock: vi.fn(),
		getEngagementMeMock: vi.fn(),
	}),
);

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return { ...actual, getMyProfile: getMyProfileMock };
});

vi.mock("@/lib/engagement-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/engagement-api")>();
	return { ...actual, getEngagementMe: getEngagementMeMock };
});

describe("AwardsPage", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getMyProfileMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Chinwe Okafor", role: "learner" } },
			isPending: false,
		});
		getMyProfileMock.mockResolvedValue({ image: null });
		getEngagementMeMock.mockReset();
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

	it("renders the leaderboard with the signed-in learner's own entry", async () => {
		renderRoute("/leaderboard");

		// LearnerShell also renders a sr-only mobile h1 with the same title text.
		expect(
			(await screen.findAllByText("Awards & leaderboard")).length,
		).toBeGreaterThan(0);
		expect(
			screen.getByText(
				"Example standings — live rankings activate when you join a cohort.",
			),
		).toBeInTheDocument();
		// The learner's own row always renders as "You", not their real name.
		expect(screen.getByText("Your position")).toBeInTheDocument();
	});

	it("renders the live 'Your awards' grid above the preview roster (Phase 4)", async () => {
		renderRoute("/leaderboard");

		expect(await screen.findByTestId("badge-grid")).toBeInTheDocument();
		expect(screen.getByText("1 of 2 earned")).toBeInTheDocument();
		// Earned in colour with a date; locked with its criteria hint.
		expect(screen.getByText("First Steps")).toBeInTheDocument();
		expect(screen.getByText("Complete 10 lessons")).toBeInTheDocument();
	});

	it("renders the top-3 podium from the preview roster", async () => {
		renderRoute("/leaderboard");

		await screen.findAllByText("Awards & leaderboard");
		expect(screen.getByText("Amara Okafor")).toBeInTheDocument();
	});

	it("switches the leaderboard type tab without crashing", async () => {
		const user = userEvent.setup();
		renderRoute("/leaderboard");
		await screen.findAllByText("Awards & leaderboard");

		await user.click(screen.getByRole("button", { name: "Consistency" }));

		expect(screen.getByText("Amara Okafor")).toBeInTheDocument();
	});
});
