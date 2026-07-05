// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PathDetail } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const {
	useSessionMock,
	getPathMock,
	addPathCourseMock,
	removePathCourseMock,
	publishPathMock,
	deletePathMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getPathMock: vi.fn(),
	addPathCourseMock: vi.fn(),
	removePathCourseMock: vi.fn(),
	publishPathMock: vi.fn(),
	deletePathMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getPath: getPathMock,
		addPathCourse: addPathCourseMock,
		removePathCourse: removePathCourseMock,
		publishPath: publishPathMock,
		deletePath: deletePathMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function pathDetail(overrides: Partial<PathDetail> = {}): PathDetail {
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
		_count: { pathCourses: 1 },
		price: 10000,
		isFree: false,
		currency: "NGN",
		isEarnBackEligible: false,
		earnBackPercentage: null,
		description: null,
		outcomeStatement: null,
		estimatedDuration: null,
		earnBackDeadlineDays: null,
		isFeatured: false,
		featureRequested: false,
		introLesson: null,
		pathCourses: [
			{
				orderIndex: 0,
				isRequired: true,
				course: {
					id: "c1",
					title: "React Basics",
					status: "published",
					level: "beginner",
				},
			},
		],
		availableCourses: [
			{ id: "c2", title: "Vue Basics", status: "draft" } as never,
		],
		...overrides,
	};
}

describe("PathEditorRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getPathMock.mockReset();
		addPathCourseMock.mockReset();
		removePathCourseMock.mockReset();
		publishPathMock.mockReset();
		deletePathMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "instructor" } },
			isPending: false,
		});
	});

	it("renders the path courses list", async () => {
		getPathMock.mockResolvedValue(pathDetail());
		renderRoute("/instructor/paths/p1");

		expect(await screen.findByText("Courses in this path")).toBeInTheDocument();
		expect(screen.getByText("React Basics")).toBeInTheDocument();
	});

	it("adds an available course to the path", async () => {
		getPathMock.mockResolvedValue(pathDetail());
		addPathCourseMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/instructor/paths/p1");
		await screen.findByText("React Basics");

		// PathSettingsPanel also renders level/currency selects — the add-course
		// select is the last combobox on the page.
		const selects = screen.getAllByRole("combobox");
		await user.selectOptions(selects[selects.length - 1], "c2");
		await user.click(screen.getByRole("button", { name: "Add course" }));

		await waitFor(() => {
			expect(addPathCourseMock).toHaveBeenCalledWith("p1", "c2");
		});
	});

	it("removes a course from the path", async () => {
		getPathMock.mockResolvedValue(pathDetail());
		removePathCourseMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/instructor/paths/p1");
		await screen.findByText("React Basics");

		// The header's path-level "Delete" and the course row's icon-only
		// "Delete" share the same accessible name.
		const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
		await user.click(deleteButtons[deleteButtons.length - 1]);

		await waitFor(() => {
			expect(removePathCourseMock).toHaveBeenCalledWith("p1", "c1");
		});
	});

	it("publishes the path", async () => {
		const { toast } = await import("sonner");
		getPathMock.mockResolvedValue(pathDetail());
		publishPathMock.mockResolvedValue(pathDetail({ status: "published" }));
		const user = userEvent.setup();
		renderRoute("/instructor/paths/p1");
		await screen.findByText("React Basics");

		await user.click(screen.getByRole("button", { name: "Publish path" }));

		await waitFor(() => {
			expect(publishPathMock).toHaveBeenCalledWith("p1");
		});
		expect(toast.success).toHaveBeenCalledWith("Path published");
	});

	it("shows the draft-courses note when a course in the path isn't published", async () => {
		getPathMock.mockResolvedValue(
			pathDetail({
				pathCourses: [
					{
						orderIndex: 0,
						isRequired: true,
						course: {
							id: "c1",
							title: "React Basics",
							status: "draft",
							level: "beginner",
						},
					},
				],
			}),
		);
		renderRoute("/instructor/paths/p1");

		expect(
			await screen.findByText(
				"Some courses are still drafts — publish them so learners can start.",
			),
		).toBeInTheDocument();
	});

	it("shows the empty state when the path has no courses", async () => {
		getPathMock.mockResolvedValue(pathDetail({ pathCourses: [] }));
		renderRoute("/instructor/paths/p1");

		// Real locale key overrides the component's "— add one below." fallback text.
		expect(await screen.findByText("No courses yet.")).toBeInTheDocument();
	});

	it("shows the load-failed message when the path fails to fetch (e.g. a 403 from a path this instructor doesn't own)", async () => {
		getPathMock.mockRejectedValue(new Error("You do not own this path"));
		renderRoute("/instructor/paths/p1");

		expect(
			await screen.findByText("Path could not be loaded"),
		).toBeInTheDocument();
		expect(screen.getByText("You do not own this path")).toBeInTheDocument();
	});
});
