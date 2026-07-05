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
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getPublishedCoursesMock: vi.fn(),
	getMyLearningMock: vi.fn(),
	getMyProfileMock: vi.fn(),
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
		_count: { modules: 4 },
		...overrides,
	};
}

function emptyMyLearning(): MyLearning {
	return { courses: [], paths: [], cohorts: [] };
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
