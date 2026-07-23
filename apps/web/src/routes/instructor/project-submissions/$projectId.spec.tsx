// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SubmissionForGrading, SubmissionRow } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const {
	useSessionMock,
	listProjectSubmissionsMock,
	getSubmissionForGradingMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	listProjectSubmissionsMock: vi.fn(),
	getSubmissionForGradingMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		listProjectSubmissions: listProjectSubmissionsMock,
		getSubmissionForGrading: getSubmissionForGradingMock,
	};
});

// Distinct from the mocked session user's name — sharing a name would collide
// with the StudioShell sidebar's own profile text (see the attempt-reports
// spec's note on this exact gotcha).
function submissionRow(overrides: Partial<SubmissionRow> = {}): SubmissionRow {
	return {
		id: "sub1",
		attemptNumber: 1,
		userName: "Chinwe Okafor",
		userEmail: "chinwe@example.com",
		submittedAt: new Date().toISOString(),
		graded: false,
		score: null,
		passed: null,
		gradedByName: null,
		isOverrideGrade: false,
		canGrade: true,
		...overrides,
	};
}

function submissionForGrading(): SubmissionForGrading {
	return {
		id: "sub1",
		attemptNumber: 1,
		userName: "Chinwe Okafor",
		userEmail: "chinwe@example.com",
		submittedAt: new Date().toISOString(),
		textContent: "Here is my write-up.",
		urlSubmission: null,
		codeConfig: null,
		files: [],
		projectId: "proj1",
		projectTitle: "Build a todo app",
		brief: null,
		gradingType: "manual",
		passMark: 70,
		rubric: [],
		graded: false,
		score: null,
		passed: null,
		feedback: null,
		rubricScores: null,
	};
}

describe("InstructorSubmissionsRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		listProjectSubmissionsMock.mockReset();
		getSubmissionForGradingMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "instructor" } },
			isPending: false,
		});
	});

	it("renders the submissions list with graded/awaiting status", async () => {
		listProjectSubmissionsMock.mockResolvedValue([
			submissionRow({ id: "sub1", userName: "Chinwe Okafor", graded: false }),
			submissionRow({
				id: "sub2",
				userName: "Femi Ade",
				graded: true,
				score: 88,
				passed: true,
			}),
		]);
		renderRoute("/instructor/project-submissions/proj1");

		// The row appends a formatted submittedAt date onto the same text node.
		expect(await screen.findByText("Chinwe Okafor")).toBeInTheDocument();
		expect(screen.getByText(/Awaiting grade/)).toBeInTheDocument();
		expect(screen.getByText("Femi Ade")).toBeInTheDocument();
		expect(screen.getByText(/Graded · 88%/)).toBeInTheDocument();
	});

	it("shows the empty state when there are no submissions", async () => {
		listProjectSubmissionsMock.mockResolvedValue([]);
		renderRoute("/instructor/project-submissions/proj1");

		expect(await screen.findByText("No submissions yet.")).toBeInTheDocument();
	});

	it("opens the grading dialog when a submission is clicked", async () => {
		listProjectSubmissionsMock.mockResolvedValue([submissionRow()]);
		getSubmissionForGradingMock.mockResolvedValue(submissionForGrading());
		const user = userEvent.setup();
		renderRoute("/instructor/project-submissions/proj1");
		await screen.findByText("Chinwe Okafor");

		await user.click(screen.getByRole("button", { name: /Chinwe Okafor/ }));

		await waitFor(() => {
			expect(screen.getByText("Grade submission")).toBeInTheDocument();
		});
	});

	it("shows a load-failed message instead of a misleading empty state when the queue fails to fetch (e.g. a 403 from a project this instructor doesn't own)", async () => {
		listProjectSubmissionsMock.mockRejectedValue(
			new Error("You do not own this content"),
		);
		renderRoute("/instructor/project-submissions/proj1");

		expect(
			await screen.findByText("Submissions could not be loaded"),
		).toBeInTheDocument();
		expect(screen.getByText("You do not own this content")).toBeInTheDocument();
		// The old bug: this same failure used to render as if there were
		// simply no submissions yet, indistinguishable from a real empty queue.
		expect(screen.queryByText("No submissions yet.")).not.toBeInTheDocument();
	});

	it("shows a load-failed message in the grading dialog instead of an infinite spinner when the submission fails to fetch", async () => {
		listProjectSubmissionsMock.mockResolvedValue([submissionRow()]);
		getSubmissionForGradingMock.mockRejectedValue(
			new Error("You do not own this content"),
		);
		const user = userEvent.setup();
		renderRoute("/instructor/project-submissions/proj1");
		await screen.findByText("Chinwe Okafor");

		await user.click(screen.getByRole("button", { name: /Chinwe Okafor/ }));

		expect(
			await screen.findByText("Submission could not be loaded"),
		).toBeInTheDocument();
	});
});
