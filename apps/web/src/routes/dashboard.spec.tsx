// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MyLearning, PublishedCourse } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const {
	useSessionMock,
	getPublishedCoursesMock,
	getMyLearningMock,
	getMyProfileMock,
	getEngagementMeMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getPublishedCoursesMock: vi.fn(),
	getMyLearningMock: vi.fn(),
	getMyProfileMock: vi.fn(),
	getEngagementMeMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getPublishedCourses: getPublishedCoursesMock,
		getMyLearning: getMyLearningMock,
		getMyProfile: getMyProfileMock,
	};
});

vi.mock("@/lib/engagement-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/engagement-api")>();
	return { ...actual, getEngagementMe: getEngagementMeMock };
});

function course(overrides: Partial<PublishedCourse> = {}): PublishedCourse {
	return {
		id: "c1",
		title: "React Basics",
		slug: "react-basics",
		description: null,
		level: "beginner",
		language: "en",
		thumbnailKey: null,
		thumbnailUrl: null,
		price: 5000,
		isFree: false,
		currency: "NGN",
		isEarnBackEligible: false,
		earnBackPercentage: null,
		enrolledCount: 0,
		_count: { modules: 4 },
		...overrides,
	};
}

function emptyMyLearning(): MyLearning {
	return { courses: [], paths: [], cohorts: [] };
}

function engagementMe(current = 3) {
	const today = new Date().toISOString().slice(0, 10);
	return {
		streak: {
			current,
			longest: current,
			freezes: 1,
			lastActiveDate: today,
			atRisk: false,
			todayDone: true,
		},
		weekActivity: Array.from({ length: 7 }, (_, i) => ({
			date: `2026-07-0${i + 1}`,
			active: i === 6,
		})),
		badges: [],
		unseenBadgeKeys: [],
		allBadgeKeys: ["first_lesson"],
		nextBadge: { key: "lessons_10", current: 8, target: 10 },
	};
}

describe("DashboardPage", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getPublishedCoursesMock.mockReset();
		getMyLearningMock.mockReset();
		getMyProfileMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "learner" } },
			isPending: false,
		});
		getMyProfileMock.mockResolvedValue({ image: null });
		getEngagementMeMock.mockReset();
		getEngagementMeMock.mockResolvedValue(engagementMe());
	});

	it("greets the learner by first name and shows the empty continue-learning state", async () => {
		getPublishedCoursesMock.mockResolvedValue([]);
		getMyLearningMock.mockResolvedValue(emptyMyLearning());
		renderRoute("/dashboard");

		expect(await screen.findByText(/Ada, Let's keep/)).toBeInTheDocument();
		expect(
			screen.getByText("Your enrolled courses will show up here."),
		).toBeInTheDocument();
	});

	it("shows the recommended courses carousel when courses are published", async () => {
		getPublishedCoursesMock.mockResolvedValue([course()]);
		getMyLearningMock.mockResolvedValue(emptyMyLearning());
		renderRoute("/dashboard");

		expect(await screen.findByText("React Basics")).toBeInTheDocument();
	});

	it("shows the empty-courses message when none are published", async () => {
		getPublishedCoursesMock.mockResolvedValue([]);
		getMyLearningMock.mockResolvedValue(emptyMyLearning());
		renderRoute("/dashboard");

		expect(
			await screen.findByText("No courses are published yet. Check back soon!"),
		).toBeInTheDocument();
	});

	it("shows the live streak in the stats tile and the streak panel (Phase 4, §3.2)", async () => {
		getPublishedCoursesMock.mockResolvedValue([]);
		getMyLearningMock.mockResolvedValue(emptyMyLearning());
		getEngagementMeMock.mockResolvedValue(engagementMe(5));
		renderRoute("/dashboard");

		// The panel only mounts once the engagement query resolves — wait for it
		// before asserting the tile's live value.
		expect(await screen.findByTestId("streak-panel")).toBeInTheDocument();
		expect(screen.getByTestId("stat-streak")).toHaveTextContent("5");
		expect(
			screen.getByText(
				"Today is in the bag. Come back tomorrow to keep the flame burning.",
			),
		).toBeInTheDocument();
	});

	it("shows the goal-gradient nudge for the nearest locked badge (§3.2)", async () => {
		getPublishedCoursesMock.mockResolvedValue([]);
		getMyLearningMock.mockResolvedValue(emptyMyLearning());
		renderRoute("/dashboard");

		expect(await screen.findByTestId("next-badge-nudge")).toBeInTheDocument();
		expect(
			screen.getByText("2 more lessons unlock Deep Diver"),
		).toBeInTheDocument();
	});

	it("shows the in-progress course when the learner has one", async () => {
		getPublishedCoursesMock.mockResolvedValue([]);
		getMyLearningMock.mockResolvedValue({
			courses: [
				{
					type: "course",
					id: "c1",
					title: "React Basics",
					slug: "react-basics",
					thumbnailUrl: null,
					isFree: false,
					isEarnBackEligible: false,
					earnBackPercentage: null,
					percent: 40,
					isComplete: false,
				},
			],
			paths: [],
			cohorts: [],
		});
		renderRoute("/dashboard");

		expect(await screen.findByText("React Basics")).toBeInTheDocument();
		expect(
			screen.queryByText("Your enrolled courses will show up here."),
		).not.toBeInTheDocument();
	});
});
