// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseSummary, FeatureRequestItem } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const {
	useSessionMock,
	listMyCoursesMock,
	listMyPathsMock,
	listCohortsMock,
	getFeatureRequestsMock,
	updateCourseMock,
	getAdminAnalyticsMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	listMyCoursesMock: vi.fn(),
	listMyPathsMock: vi.fn(),
	listCohortsMock: vi.fn(),
	getFeatureRequestsMock: vi.fn(),
	updateCourseMock: vi.fn(),
	getAdminAnalyticsMock: vi.fn(),
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
		listCohorts: listCohortsMock,
		getFeatureRequests: getFeatureRequestsMock,
		updateCourse: updateCourseMock,
	};
});

vi.mock("@/lib/analytics-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/analytics-api")>();
	return { ...actual, getAdminAnalytics: getAdminAnalyticsMock };
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

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

function session(role = "admin") {
	return {
		data: { user: { id: "u1", name: "Ada Lovelace", role } },
		isPending: false,
	};
}

describe("AdminDashboardPage", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		listMyCoursesMock.mockReset();
		listMyPathsMock.mockReset();
		listCohortsMock.mockReset();
		getFeatureRequestsMock.mockReset();
		updateCourseMock.mockReset();
		useSessionMock.mockReturnValue(session());
		listMyPathsMock.mockResolvedValue([]);
		listCohortsMock.mockResolvedValue([]);
		getFeatureRequestsMock.mockResolvedValue([]);
		getAdminAnalyticsMock.mockReset();
		getAdminAnalyticsMock.mockResolvedValue({
			platform: {
				learners: 120,
				instructors: 8,
				publishedCourses: 5,
				publishedPaths: 2,
				openCohorts: 1,
				enrollments: 300,
				completions: 90,
				completionRate: 30,
				activeLearners7d: 41,
				newLearners30d: 17,
			},
			totals: {
				items: 5,
				published: 5,
				enrollments: 300,
				completions: 90,
				inProgress: 100,
				notStarted: 110,
				completionRate: 30,
			},
			courses: [
				{
					// Distinct from the content fixtures' "React Basics" — duplicate
					// text breaks the pre-existing exact-match findByText assertions.
					id: "c1",
					title: "Analytics Course",
					status: "published",
					live: true,
					enrolled: 300,
					completed: 90,
					inProgress: 100,
					notStarted: 110,
					completionRate: 30,
					avgProgressPct: 44,
					lastEnrolledAt: new Date().toISOString(),
					instructorName: "Chinwe Okafor",
				},
			],
			paths: [],
			cohorts: [],
		});
	});

	it("renders the admin heading and recent course list", async () => {
		listMyCoursesMock.mockResolvedValue([course()]);
		renderRoute("/admin");

		expect(
			await screen.findByText("Keep the learning system healthy"),
		).toBeInTheDocument();
		expect(await screen.findByText("React Basics")).toBeInTheDocument();
	});

	it("shows a compact platform analytics summary + a link to the full page (§2.4)", async () => {
		listMyCoursesMock.mockResolvedValue([]);
		renderRoute("/admin");

		const section = await screen.findByTestId("admin-analytics");
		// Compact KPI tiles resolve from the analytics query.
		expect(await within(section).findByText("41")).toBeInTheDocument();
		expect(section).toHaveTextContent("Active learners (7d)");
		expect(section).toHaveTextContent("30%");
		// Full breakdown (with the all-courses table) moved to its own page.
		const link = within(section).getByRole("link", { name: /View analytics/i });
		expect(link).toHaveAttribute("href", "/admin/analytics");
		expect(
			screen.queryByTestId("entity-analytics-list"),
		).not.toBeInTheDocument();
	});

	it("shows the empty-content message when there are no courses", async () => {
		listMyCoursesMock.mockResolvedValue([]);
		renderRoute("/admin");

		expect(
			await screen.findByText("No courses have been created yet."),
		).toBeInTheDocument();
	});

	it("shows pending feature requests and approves one", async () => {
		listMyCoursesMock.mockResolvedValue([]);
		const request: FeatureRequestItem = {
			type: "course",
			id: "c1",
			title: "React Basics",
			slug: "react-basics",
			isFeatured: false,
		};
		getFeatureRequestsMock.mockResolvedValue([request]);
		updateCourseMock.mockResolvedValue(course({ isFeatured: true } as never));
		const user = userEvent.setup();
		renderRoute("/admin");

		expect(await screen.findByText("Feature requests")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Feature" }));

		await waitFor(() => {
			expect(updateCourseMock).toHaveBeenCalledWith("c1", {
				isFeatured: true,
			});
		});
	});

	it("hides the feature-requests section when there are none pending", async () => {
		listMyCoursesMock.mockResolvedValue([]);
		getFeatureRequestsMock.mockResolvedValue([]);
		renderRoute("/admin");

		await screen.findByText("Keep the learning system healthy");
		expect(screen.queryByText("Feature requests")).not.toBeInTheDocument();
	});
});
