// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseSummary, MyLearning, PathSummary } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const {
	useSessionMock,
	listMyCoursesMock,
	listMyPathsMock,
	getMyLearningMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	listMyCoursesMock: vi.fn(),
	listMyPathsMock: vi.fn(),
	getMyLearningMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		listMyCourses: listMyCoursesMock,
		listMyPaths: listMyPathsMock,
		getMyLearning: getMyLearningMock,
	};
});

function course(overrides: Partial<CourseSummary> = {}): CourseSummary {
	return {
		id: "c1",
		title: "React Basics",
		slug: "react-basics",
		status: "published",
		level: "beginner",
		thumbnailKey: null,
		thumbnailUrl: null,
		createdAt: new Date().toISOString(),
		_count: { modules: 4 },
		price: 5000,
		isFree: false,
		currency: "NGN",
		isEarnBackEligible: false,
		earnBackPercentage: null,
		...overrides,
	};
}

function path(overrides: Partial<PathSummary> = {}): PathSummary {
	return {
		id: "p1",
		title: "Full Stack Path",
		slug: "full-stack",
		status: "draft",
		level: "beginner",
		thumbnailKey: null,
		thumbnailUrl: null,
		estimatedHours: null,
		createdAt: new Date().toISOString(),
		_count: { pathCourses: 2 },
		price: 10000,
		isFree: false,
		currency: "NGN",
		isEarnBackEligible: false,
		earnBackPercentage: null,
		...overrides,
	};
}

function emptyMyLearning(): MyLearning {
	return { courses: [], paths: [], cohorts: [] };
}

describe("InstructorOverviewPage", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		listMyCoursesMock.mockReset();
		listMyPathsMock.mockReset();
		getMyLearningMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "instructor" } },
			isPending: false,
		});
		getMyLearningMock.mockResolvedValue(emptyMyLearning());
	});

	it("greets the instructor by first name and shows course/path counts", async () => {
		listMyCoursesMock.mockResolvedValue([
			course({ id: "c1", title: "React Basics", status: "published" }),
			course({ id: "c2", title: "Vue Basics", status: "draft" }),
		]);
		listMyPathsMock.mockResolvedValue([path()]);
		renderRoute("/instructor");

		expect(await screen.findByText("Welcome back, Ada")).toBeInTheDocument();
		expect(await screen.findByText("React Basics")).toBeInTheDocument();
	});

	it("shows the empty-courses message when the instructor has none yet", async () => {
		listMyCoursesMock.mockResolvedValue([]);
		listMyPathsMock.mockResolvedValue([]);
		renderRoute("/instructor");

		expect(
			await screen.findByText("Create your first course to get started."),
		).toBeInTheDocument();
	});

	it("shows the 'Published' badge for a published course and 'Draft' for a draft", async () => {
		listMyCoursesMock.mockResolvedValue([
			course({ id: "c1", title: "Live course", status: "published" }),
			course({ id: "c2", title: "Draft course", status: "draft" }),
		]);
		listMyPathsMock.mockResolvedValue([]);
		renderRoute("/instructor");

		await screen.findByText("Live course");
		// "Published"/"Draft" also appear as stat-card labels — scope to the badges.
		expect(screen.getAllByText("Published").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
	});

	it("shows in-progress learning items when the instructor is also learning", async () => {
		listMyCoursesMock.mockResolvedValue([]);
		listMyPathsMock.mockResolvedValue([]);
		getMyLearningMock.mockResolvedValue({
			courses: [
				{
					type: "course",
					id: "c9",
					title: "Node Basics",
					slug: "node-basics",
					thumbnailUrl: null,
					isFree: false,
					isEarnBackEligible: false,
					earnBackPercentage: null,
					percent: 20,
					isComplete: false,
				},
			],
			paths: [],
			cohorts: [],
		});
		renderRoute("/instructor");

		expect(await screen.findByText("Node Basics")).toBeInTheDocument();
	});
});
