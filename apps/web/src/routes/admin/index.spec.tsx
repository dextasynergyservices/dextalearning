// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
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
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	listMyCoursesMock: vi.fn(),
	listMyPathsMock: vi.fn(),
	listCohortsMock: vi.fn(),
	getFeatureRequestsMock: vi.fn(),
	updateCourseMock: vi.fn(),
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
	});

	it("renders the admin heading and recent course list", async () => {
		listMyCoursesMock.mockResolvedValue([course()]);
		renderRoute("/admin");

		expect(
			await screen.findByText("Keep the learning system healthy"),
		).toBeInTheDocument();
		expect(await screen.findByText("React Basics")).toBeInTheDocument();
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
