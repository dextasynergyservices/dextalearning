// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { CourseDetail } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const {
	useSessionMock,
	getCourseMock,
	createModuleMock,
	createLessonMock,
	deleteModuleMock,
	deleteCourseMock,
	publishCourseMock,
	reorderLessonsMock,
	listAssessmentsMock,
	listProjectsMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getCourseMock: vi.fn(),
	createModuleMock: vi.fn(),
	createLessonMock: vi.fn(),
	deleteModuleMock: vi.fn(),
	deleteCourseMock: vi.fn(),
	publishCourseMock: vi.fn(),
	reorderLessonsMock: vi.fn(),
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
		createModule: createModuleMock,
		createLesson: createLessonMock,
		deleteModule: deleteModuleMock,
		deleteCourse: deleteCourseMock,
		publishCourse: publishCourseMock,
		reorderLessons: reorderLessonsMock,
		listAssessments: listAssessmentsMock,
		listProjects: listProjectsMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function courseDetail(overrides: Partial<CourseDetail> = {}): CourseDetail {
	return {
		id: "c1",
		title: "React Basics",
		slug: "react-basics",
		status: "draft",
		level: "beginner",
		thumbnailKey: null,
		thumbnailUrl: null,
		createdAt: new Date().toISOString(),
		_count: { modules: 1 },
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
		modules: [
			{
				id: "m1",
				title: "Getting started",
				orderIndex: 0,
				lessons: [
					{
						id: "l1",
						title: "Intro",
						contentType: "video",
						orderIndex: 0,
						introForPathId: null,
						introForCohortId: null,
						transcriptText: null,
						transcriptCuesJson: null,
						videoKeysJson: null,
					} as never,
				],
			},
		],
		...overrides,
	};
}

describe("InstructorCourseEditorRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getCourseMock.mockReset();
		createModuleMock.mockReset();
		createLessonMock.mockReset();
		deleteModuleMock.mockReset();
		deleteCourseMock.mockReset();
		publishCourseMock.mockReset();
		reorderLessonsMock.mockReset();
		listAssessmentsMock.mockReset();
		listProjectsMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "instructor" } },
			isPending: false,
		});
		listAssessmentsMock.mockResolvedValue([]);
		listProjectsMock.mockResolvedValue([]);
	});

	it("renders the course title, module and lesson", async () => {
		getCourseMock.mockResolvedValue(courseDetail());
		renderRoute("/instructor/courses/c1");

		expect(await screen.findByText("Getting started")).toBeInTheDocument();
		expect(screen.getByText("Intro")).toBeInTheDocument();
	});

	it("adds a module", async () => {
		getCourseMock.mockResolvedValue(courseDetail());
		createModuleMock.mockResolvedValue({
			id: "m2",
			title: "Advanced topics",
			orderIndex: 1,
			lessons: [],
		});
		const user = userEvent.setup();
		renderRoute("/instructor/courses/c1");
		await screen.findByText("Getting started");

		await user.type(
			screen.getByPlaceholderText("Module title"),
			"Advanced topics",
		);
		await user.click(screen.getByRole("button", { name: "Add module" }));

		await waitFor(() => {
			expect(createModuleMock).toHaveBeenCalledWith("c1", "Advanced topics");
		});
	});

	it("adds a lesson to a module", async () => {
		getCourseMock.mockResolvedValue(courseDetail());
		createLessonMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/instructor/courses/c1");
		await screen.findByText("Getting started");

		await user.type(screen.getByPlaceholderText("Lesson title"), "Setup");
		await user.click(screen.getByRole("button", { name: "Add lesson" }));

		await waitFor(() => {
			expect(createLessonMock).toHaveBeenCalledWith("m1", { title: "Setup" });
		});
	});

	it("publishes the course successfully", async () => {
		const { toast } = await import("sonner");
		getCourseMock.mockResolvedValue(courseDetail());
		publishCourseMock.mockResolvedValue(courseDetail({ status: "published" }));
		const user = userEvent.setup();
		renderRoute("/instructor/courses/c1");
		await screen.findByText("Getting started");

		await user.click(screen.getByRole("button", { name: "Publish course" }));

		await waitFor(() => {
			expect(publishCourseMock).toHaveBeenCalledWith("c1");
		});
		expect(toast.success).toHaveBeenCalledWith("Course published 🎉");
	});

	it("shows the blocked-issue list when publishing fails validation", async () => {
		getCourseMock.mockResolvedValue(courseDetail());
		publishCourseMock.mockRejectedValue(
			new ApiError("Not publishable", "COURSE_NOT_PUBLISHABLE", {
				issues: [
					{
						lessonId: "l1",
						title: "Intro",
						reason: "missing_transcript",
					},
				],
			}),
		);
		const user = userEvent.setup();
		renderRoute("/instructor/courses/c1");
		await screen.findByText("Getting started");

		await user.click(screen.getByRole("button", { name: "Publish course" }));

		expect(
			await screen.findByText("Fix these before publishing"),
		).toBeInTheDocument();
		expect(screen.getByText("Add a transcript.")).toBeInTheDocument();
	});

	it("deletes the course after confirming", async () => {
		const { toast } = await import("sonner");
		getCourseMock.mockResolvedValue(courseDetail());
		deleteCourseMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/instructor/courses/c1");
		await screen.findByText("Getting started");

		// The header's course-level "Delete" button and each module card's
		// icon-only "Delete" button share the same accessible name.
		const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
		await user.click(deleteButtons[0]);
		expect(await screen.findByText("Delete course?")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Delete course" }));

		await waitFor(() => {
			expect(deleteCourseMock).toHaveBeenCalledWith("c1");
		});
		expect(toast.success).toHaveBeenCalledWith("Course deleted");
	});
});
