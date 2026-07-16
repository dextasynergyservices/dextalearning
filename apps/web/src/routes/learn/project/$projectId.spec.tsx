// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectInfo } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, getProjectInfoMock, submitProjectMock } = vi.hoisted(
	() => ({
		useSessionMock: vi.fn(),
		getProjectInfoMock: vi.fn(),
		submitProjectMock: vi.fn(),
	}),
);

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getProjectInfo: getProjectInfoMock,
		submitProject: submitProjectMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function project(overrides: Partial<ProjectInfo> = {}): ProjectInfo {
	return {
		id: "proj1",
		title: "Build a todo app",
		description: "Ship a working CRUD app.",
		scope: "course",
		submissionTypes: ["text_submission", "url_submission"],
		gradingType: "manual",
		passMark: 70,
		dueAt: null,
		maxFileSizeMb: 50,
		allowedFileTypes: [],
		peerReviewCount: 0,
		rubric: null,
		mySubmission: null,
		peerReview: null,
		prerequisitesMet: true,
		maxAttempts: null,
		retryCooldownHours: null,
		retryLockoutDays: null,
		retry: {
			attemptsUsed: 0,
			attemptsRemaining: null,
			canRetry: true,
			reason: null,
			nextAttemptAt: null,
			lockedUntil: null,
		},
		...overrides,
	};
}

describe("ProjectSubmitRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getProjectInfoMock.mockReset();
		submitProjectMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "learner" } },
			isPending: false,
		});
	});

	it("renders the project brief and submission form fields", async () => {
		getProjectInfoMock.mockResolvedValue(project());
		renderRoute("/learn/project/proj1");

		expect(await screen.findByText("Build a todo app")).toBeInTheDocument();
		expect(screen.getByText("Ship a working CRUD app.")).toBeInTheDocument();
		expect(screen.getByText("Write-up")).toBeInTheDocument();
		expect(screen.getByText("Link / URL")).toBeInTheDocument();
	});

	it("submits the project and shows a success toast", async () => {
		const { toast } = await import("sonner");
		getProjectInfoMock.mockResolvedValue(project());
		submitProjectMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/learn/project/proj1");
		await screen.findByText("Build a todo app");

		await user.click(screen.getByRole("button", { name: /Submit project/ }));

		await waitFor(() => {
			expect(submitProjectMock).toHaveBeenCalledWith("proj1", {});
		});
		expect(toast.success).toHaveBeenCalledWith("Submission sent");
	});

	it("shows the graded status when the submission has been graded", async () => {
		getProjectInfoMock.mockResolvedValue(
			project({
				mySubmission: {
					id: "sub1",
					attemptNumber: 1,
					submittedAt: new Date().toISOString(),
					textContent: "Done",
					urlSubmission: null,
					files: [],
					graded: true,
					score: 90,
					passed: true,
					feedback: "Great work!",
					peerReviewsAssigned: 0,
					peerReviewsCompleted: 0,
				},
			}),
		);
		renderRoute("/learn/project/proj1");

		expect(await screen.findByText(/Passed · 90%/)).toBeInTheDocument();
		expect(screen.getByText("Great work!")).toBeInTheDocument();
		// A passed submission locks the form — no resubmit section.
		expect(
			screen.queryByRole("button", { name: /Resubmit/ }),
		).not.toBeInTheDocument();
	});

	it("shows the pending-grading message for an ungraded submission", async () => {
		getProjectInfoMock.mockResolvedValue(
			project({
				mySubmission: {
					id: "sub1",
					attemptNumber: 1,
					submittedAt: new Date().toISOString(),
					textContent: "Done",
					urlSubmission: null,
					files: [],
					graded: false,
					score: null,
					passed: null,
					feedback: null,
					peerReviewsAssigned: 0,
					peerReviewsCompleted: 0,
				},
			}),
		);
		renderRoute("/learn/project/proj1");

		expect(
			await screen.findByText("Submitted — awaiting grading."),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /Resubmit/ }),
		).toBeInTheDocument();
	});

	it("links to the peer-review flow when reviews are still owed", async () => {
		getProjectInfoMock.mockResolvedValue(
			project({ peerReview: { required: 2, completed: 0 } }),
		);
		renderRoute("/learn/project/proj1");

		const link = await screen.findByRole("link", {
			name: /Complete 2 peer review\(s\) to finish this project\./,
		});
		expect(link).toHaveAttribute("href", "/learn/peer-review/proj1");
	});
});
