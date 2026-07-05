// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CohortDetail } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const {
	useSessionMock,
	getCohortMock,
	updateCohortMock,
	publishCohortMock,
	deleteCohortMock,
	addCohortCourseMock,
	removeCohortCourseMock,
	addCohortPathMock,
	assignCohortInstructorMock,
	removeCohortInstructorMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getCohortMock: vi.fn(),
	updateCohortMock: vi.fn(),
	publishCohortMock: vi.fn(),
	deleteCohortMock: vi.fn(),
	addCohortCourseMock: vi.fn(),
	removeCohortCourseMock: vi.fn(),
	addCohortPathMock: vi.fn(),
	assignCohortInstructorMock: vi.fn(),
	removeCohortInstructorMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getCohort: getCohortMock,
		updateCohort: updateCohortMock,
		publishCohort: publishCohortMock,
		deleteCohort: deleteCohortMock,
		addCohortCourse: addCohortCourseMock,
		removeCohortCourse: removeCohortCourseMock,
		addCohortPath: addCohortPathMock,
		assignCohortInstructor: assignCohortInstructorMock,
		removeCohortInstructor: removeCohortInstructorMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function cohortDetail(overrides: Partial<CohortDetail> = {}): CohortDetail {
	return {
		id: "co1",
		title: "January Cohort",
		slug: "january-cohort",
		status: "draft",
		startsAt: null,
		endsAt: null,
		capacity: 30,
		seatsFilled: 0,
		price: 2000,
		isFree: false,
		currency: "NGN",
		isEarnBackEligible: false,
		earnBackPercentage: null,
		createdAt: new Date().toISOString(),
		_count: { courses: 1 },
		description: null,
		examMode: "unified",
		unlockMode: "all_at_once",
		groupingMode: "randomized",
		targetGroupSize: 5,
		minGroupSize: 3,
		maxGroupSize: 8,
		isFeatured: false,
		introLesson: null,
		courses: [
			{
				orderIndex: 0,
				course: {
					id: "c1",
					title: "React Basics",
					status: "published",
					level: "beginner",
				},
			},
		],
		paths: [],
		instructors: [
			{
				user: { id: "i1", name: "Chinwe Okafor", email: "chinwe@example.com" },
			},
		],
		facilitators: [],
		availableCourses: [
			{ id: "c2", title: "Vue Basics", status: "draft", level: "beginner" },
		],
		availablePaths: [],
		assignableInstructors: [
			{ id: "i2", name: "Femi Ade", email: "femi@example.com" },
		],
		assignableFacilitators: [],
		...overrides,
	};
}

describe("CohortEditorPage", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getCohortMock.mockReset();
		updateCohortMock.mockReset();
		publishCohortMock.mockReset();
		deleteCohortMock.mockReset();
		addCohortCourseMock.mockReset();
		removeCohortCourseMock.mockReset();
		addCohortPathMock.mockReset();
		assignCohortInstructorMock.mockReset();
		removeCohortInstructorMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "admin" } },
			isPending: false,
		});
	});

	it("renders the cohort settings, courses and staff", async () => {
		getCohortMock.mockResolvedValue(cohortDetail());
		renderRoute("/admin/cohorts/co1");

		expect(await screen.findByText("Cohort settings")).toBeInTheDocument();
		expect(screen.getByText("React Basics")).toBeInTheDocument();
		expect(screen.getByText("Chinwe Okafor")).toBeInTheDocument();
	});

	it("saves the cohort settings", async () => {
		const { toast } = await import("sonner");
		getCohortMock.mockResolvedValue(cohortDetail());
		updateCohortMock.mockResolvedValue(cohortDetail());
		const user = userEvent.setup();
		renderRoute("/admin/cohorts/co1");
		await screen.findByText("Cohort settings");

		await user.click(screen.getByRole("button", { name: "Save settings" }));

		await waitFor(() => {
			expect(updateCohortMock).toHaveBeenCalledWith(
				"co1",
				expect.objectContaining({
					examMode: "unified",
					groupingMode: "randomized",
				}),
			);
		});
		expect(toast.success).toHaveBeenCalledWith("Settings saved");
	});

	it("opens (publishes) the cohort", async () => {
		const { toast } = await import("sonner");
		getCohortMock.mockResolvedValue(cohortDetail());
		publishCohortMock.mockResolvedValue(cohortDetail({ status: "open" }));
		const user = userEvent.setup();
		renderRoute("/admin/cohorts/co1");
		await screen.findByText("Cohort settings");

		await user.click(screen.getByRole("button", { name: "Open" }));

		await waitFor(() => {
			expect(publishCohortMock).toHaveBeenCalledWith("co1");
		});
		expect(toast.success).toHaveBeenCalledWith("Cohort opened");
	});

	it("adds an available course to the cohort", async () => {
		getCohortMock.mockResolvedValue(cohortDetail());
		addCohortCourseMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/admin/cohorts/co1");
		await screen.findByText("React Basics");

		await user.selectOptions(
			screen.getByDisplayValue("Choose a course to add…"),
			"c2",
		);
		await user.click(screen.getByRole("button", { name: "Add course" }));

		await waitFor(() => {
			expect(addCohortCourseMock).toHaveBeenCalledWith("co1", "c2");
		});
	});

	it("assigns an available instructor", async () => {
		getCohortMock.mockResolvedValue(cohortDetail());
		assignCohortInstructorMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/admin/cohorts/co1");
		await screen.findByText("Chinwe Okafor");

		await user.selectOptions(
			screen.getByDisplayValue("Choose a person…"),
			"i2",
		);
		// Both the Instructors and Facilitators columns render their own
		// "Assign" button — Instructors renders first.
		await user.click(screen.getAllByRole("button", { name: "Assign" })[0]);

		await waitFor(() => {
			expect(assignCohortInstructorMock).toHaveBeenCalledWith("co1", "i2");
		});
	});

	it("removes an assigned instructor", async () => {
		// Isolate this row: no courses/paths in the fixture means the header's
		// "Delete" and the instructor row's icon-only "Delete" are the only two.
		getCohortMock.mockResolvedValue(cohortDetail({ courses: [] }));
		removeCohortInstructorMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/admin/cohorts/co1");
		await screen.findByText("Chinwe Okafor");

		const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
		await user.click(deleteButtons[deleteButtons.length - 1]);

		await waitFor(() => {
			expect(removeCohortInstructorMock).toHaveBeenCalledWith("co1", "i1");
		});
	});

	it("deletes the cohort after confirming", async () => {
		const { toast } = await import("sonner");
		getCohortMock.mockResolvedValue(cohortDetail());
		deleteCohortMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/admin/cohorts/co1");
		await screen.findByText("Cohort settings");

		const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
		await user.click(deleteButtons[0]);
		expect(await screen.findByText("Delete cohort?")).toBeInTheDocument();

		// The confirm button reuses the courses namespace's "Delete course" label.
		await user.click(screen.getByRole("button", { name: "Delete course" }));

		await waitFor(() => {
			expect(deleteCohortMock).toHaveBeenCalledWith("co1");
		});
		expect(toast.success).toHaveBeenCalledWith("Cohort deleted");
	});
});
