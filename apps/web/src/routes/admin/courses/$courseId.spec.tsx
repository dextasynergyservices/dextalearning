// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseDetail } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, getCourseMock, listAssessmentsMock, listProjectsMock } =
	vi.hoisted(() => ({
		useSessionMock: vi.fn(),
		getCourseMock: vi.fn(),
		listAssessmentsMock: vi.fn(),
		listProjectsMock: vi.fn(),
	}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getCourse: getCourseMock,
		listAssessments: listAssessmentsMock,
		listProjects: listProjectsMock,
	};
});

function courseDetail(): CourseDetail {
	return {
		id: "c1",
		title: "React Basics",
		slug: "react-basics",
		status: "draft",
		level: "beginner",
		thumbnailKey: null,
		thumbnailUrl: null,
		createdAt: new Date().toISOString(),
		_count: { modules: 0 },
		price: 5000,
		isFree: false,
		currency: "NGN",
		isEarnBackEligible: false,
		earnBackPercentage: null,
		description: null,
		language: "en",
		estimatedDuration: null,
		hasFinalAssessment: false,
		isFeatured: false,
		featureRequested: false,
		earnBackDeadlineDays: null,
		modules: [],
	};
}

describe("AdminCourseEditorRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getCourseMock.mockReset();
		listAssessmentsMock.mockReset();
		listProjectsMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "admin" } },
			isPending: false,
		});
		listAssessmentsMock.mockResolvedValue([]);
		listProjectsMock.mockResolvedValue([]);
	});

	it("renders the admin studio chrome for the course editor", async () => {
		getCourseMock.mockResolvedValue(courseDetail());
		renderRoute("/admin/courses/c1");

		expect((await screen.findAllByText("Admin Studio")).length).toBeGreaterThan(
			0,
		);
		expect(
			await screen.findByText("Add your first module to start building."),
		).toBeInTheDocument();
	});
});
