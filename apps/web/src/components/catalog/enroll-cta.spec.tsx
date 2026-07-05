// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "@/test/render";
import { EnrollCta } from "./enroll-cta";

const {
	useSessionMock,
	getEnrollmentStatusMock,
	getCourseProgressMock,
	enrollMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getEnrollmentStatusMock: vi.fn(),
	getCourseProgressMock: vi.fn(),
	enrollMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getEnrollmentStatus: getEnrollmentStatusMock,
		getCourseProgress: getCourseProgressMock,
		enroll: enrollMock,
	};
});

function progress(percent: number) {
	return {
		course: {
			id: "c1",
			title: "Course",
			description: null,
			thumbnailUrl: null,
		},
		modules: [],
		projects: [],
		finalAssessment: null,
		summary: {
			lessonsDone: 0,
			lessonsTotal: 1,
			allLessonsDone: false,
			allModuleAssessmentsPassed: true,
			finalAssessmentPassed: true,
			allProjectsPassed: true,
			isComplete: false,
			percent,
		},
	};
}

describe("EnrollCta", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getEnrollmentStatusMock.mockReset();
		getCourseProgressMock.mockReset();
		enrollMock.mockReset();
	});

	it("sends a signed-out learner to login first", async () => {
		useSessionMock.mockReturnValue({ data: null });
		renderWithRouter(<EnrollCta type="course" id="c1" />);
		expect(
			await screen.findByRole("link", { name: "Enrol to start" }),
		).toHaveAttribute("href", expect.stringContaining("/login"));
	});

	it("offers to enrol a signed-in, not-yet-enrolled learner", async () => {
		useSessionMock.mockReturnValue({ data: { user: { id: "u1" } } });
		getEnrollmentStatusMock.mockResolvedValue({ enrolled: false });
		getCourseProgressMock.mockResolvedValue(progress(0));
		renderWithRouter(<EnrollCta type="course" id="c1" />);
		expect(
			await screen.findByRole("button", { name: "Enrol now" }),
		).toBeInTheDocument();
	});

	it("enrolling calls the API and shows a success toast", async () => {
		useSessionMock.mockReturnValue({ data: { user: { id: "u1" } } });
		getEnrollmentStatusMock.mockResolvedValue({ enrolled: false });
		getCourseProgressMock.mockResolvedValue(progress(0));
		enrollMock.mockResolvedValue({ enrolled: true });
		const user = userEvent.setup();
		renderWithRouter(<EnrollCta type="course" id="c1" />);

		await user.click(await screen.findByRole("button", { name: "Enrol now" }));
		expect(enrollMock).toHaveBeenCalledWith("course", "c1");
	});

	it("shows 'Start learning' for an enrolled learner with no progress yet", async () => {
		useSessionMock.mockReturnValue({ data: { user: { id: "u1" } } });
		getEnrollmentStatusMock.mockResolvedValue({ enrolled: true });
		getCourseProgressMock.mockResolvedValue(progress(0));
		renderWithRouter(<EnrollCta type="course" id="c1" />);
		expect(
			await screen.findByRole("link", { name: "Start learning" }),
		).toHaveAttribute("href", expect.stringContaining("/learn/course/c1"));
	});

	it("shows 'Continue learning' once the learner has made progress", async () => {
		useSessionMock.mockReturnValue({ data: { user: { id: "u1" } } });
		getEnrollmentStatusMock.mockResolvedValue({ enrolled: true });
		getCourseProgressMock.mockResolvedValue(progress(40));
		renderWithRouter(<EnrollCta type="course" id="c1" />);
		expect(
			await screen.findByRole("link", { name: "Continue learning" }),
		).toBeInTheDocument();
	});
});
