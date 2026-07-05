// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseSummary } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const {
	useSessionMock,
	listMyCoursesMock,
	createCourseMock,
	deleteCourseMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	listMyCoursesMock: vi.fn(),
	createCourseMock: vi.fn(),
	deleteCourseMock: vi.fn(),
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
		createCourse: createCourseMock,
		deleteCourse: deleteCourseMock,
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

describe("InstructorCoursesRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		listMyCoursesMock.mockReset();
		createCourseMock.mockReset();
		deleteCourseMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "instructor" } },
			isPending: false,
		});
	});

	it("renders the course list with published/module stats", async () => {
		listMyCoursesMock.mockResolvedValue([course()]);
		renderRoute("/instructor/courses");

		expect(await screen.findByText("React Basics")).toBeInTheDocument();
		expect(screen.getByText("Published")).toBeInTheDocument();
	});

	it("shows the empty state with a 'New course' action when there are none", async () => {
		listMyCoursesMock.mockResolvedValue([]);
		renderRoute("/instructor/courses");

		expect(
			await screen.findByText("You haven't created any courses yet."),
		).toBeInTheDocument();
	});

	it("creates a course from the inline form", async () => {
		listMyCoursesMock.mockResolvedValue([]);
		createCourseMock.mockResolvedValue(course({ id: "c2" }));
		const user = userEvent.setup();
		renderRoute("/instructor/courses");
		await screen.findByText("You haven't created any courses yet.");

		await user.click(screen.getAllByRole("button", { name: "New course" })[0]);
		await user.type(screen.getByPlaceholderText("Course title"), "Vue Basics");
		await user.click(screen.getByRole("button", { name: "Create course" }));

		await waitFor(() => {
			expect(createCourseMock).toHaveBeenCalledWith({ title: "Vue Basics" });
		});
	});

	it("deletes a course after confirming", async () => {
		const { toast } = await import("sonner");
		listMyCoursesMock.mockResolvedValue([course()]);
		deleteCourseMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/instructor/courses");
		await screen.findByText("React Basics");

		await user.click(screen.getByRole("button", { name: "Delete" }));
		expect(await screen.findByText("Delete course?")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Delete course" }));

		await waitFor(() => {
			expect(deleteCourseMock).toHaveBeenCalledWith("c1");
		});
		expect(toast.success).toHaveBeenCalledWith("Course deleted");
	});
});
