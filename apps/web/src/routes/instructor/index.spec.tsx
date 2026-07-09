// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseSummary, MyLearning, PathSummary } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const {
	useSessionMock,
	listMyCoursesMock,
	listMyPathsMock,
	getMyLearningMock,
	getInstructorAnalyticsMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	listMyCoursesMock: vi.fn(),
	listMyPathsMock: vi.fn(),
	getMyLearningMock: vi.fn(),
	getInstructorAnalyticsMock: vi.fn(),
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

vi.mock("@/lib/analytics-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/analytics-api")>();
	return { ...actual, getInstructorAnalytics: getInstructorAnalyticsMock };
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
		getInstructorAnalyticsMock.mockReset();
		getInstructorAnalyticsMock.mockResolvedValue({
			totals: {
				items: 1,
				courses: 1,
				paths: 0,
				published: 1,
				enrollments: 12,
				completions: 5,
				inProgress: 4,
				notStarted: 3,
				completionRate: 42,
				learnersReached: 9,
			},
			courses: [
				{
					// Distinct from the content fixtures' "React Basics" — the
					// recent-course list renders the same page, and duplicate text
					// breaks their exact-match findByText assertions.
					id: "c1",
					title: "Analytics Course",
					status: "published",
					live: true,
					enrolled: 12,
					completed: 5,
					inProgress: 4,
					notStarted: 3,
					completionRate: 42,
					avgProgressPct: 51,
					lastEnrolledAt: new Date().toISOString(),
				},
			],
			paths: [],
		});
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

	it("shows a compact analytics summary + a link to the full page (§2.4)", async () => {
		listMyCoursesMock.mockResolvedValue([course()]);
		listMyPathsMock.mockResolvedValue([]);
		renderRoute("/instructor");

		const section = await screen.findByTestId("instructor-analytics");
		// Compact KPI tiles resolve from the analytics query.
		expect(await within(section).findByText("9")).toBeInTheDocument();
		expect(section).toHaveTextContent("Learners reached");
		expect(section).toHaveTextContent("42%");
		// The full breakdown moved to its own page — a link points there, and
		// the heavy per-course table is NOT jammed into the overview.
		const link = within(section).getByRole("link", { name: /View analytics/i });
		expect(link).toHaveAttribute("href", "/instructor/analytics");
		expect(
			screen.queryByTestId("entity-analytics-list"),
		).not.toBeInTheDocument();
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
