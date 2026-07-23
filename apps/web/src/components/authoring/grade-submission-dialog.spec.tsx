// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SubmissionForGrading } from "@/lib/content-api";
import { renderWithProviders } from "@/test/render";
import { GradeSubmissionDialog } from "./grade-submission-dialog";

const { getSubmissionForGradingMock, aiDraftGradeMock, gradeSubmissionMock } =
	vi.hoisted(() => ({
		getSubmissionForGradingMock: vi.fn(),
		aiDraftGradeMock: vi.fn(),
		gradeSubmissionMock: vi.fn(),
	}));

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getSubmissionForGrading: getSubmissionForGradingMock,
		aiDraftGrade: aiDraftGradeMock,
		gradeSubmission: gradeSubmissionMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function submission(
	overrides: Partial<SubmissionForGrading> = {},
): SubmissionForGrading {
	return {
		id: "sub1",
		attemptNumber: 1,
		userName: "Ada Lovelace",
		userEmail: "ada@example.com",
		submittedAt: "2026-06-01T10:00:00.000Z",
		textContent: "Here is my write-up.",
		urlSubmission: null,
		codeConfig: null,
		files: [],
		projectId: "proj1",
		projectTitle: "Build a todo app",
		brief: null,
		gradingType: "manual",
		passMark: 70,
		rubric: [{ id: "r1", label: "Code quality", maxPoints: 10 }],
		graded: false,
		score: null,
		passed: null,
		feedback: null,
		rubricScores: null,
		...overrides,
	};
}

describe("GradeSubmissionDialog", () => {
	beforeEach(() => {
		getSubmissionForGradingMock.mockReset();
		aiDraftGradeMock.mockReset();
		gradeSubmissionMock.mockReset();
	});

	it("renders the submission content and rubric once loaded", async () => {
		getSubmissionForGradingMock.mockResolvedValue(submission());
		renderWithProviders(
			<GradeSubmissionDialog
				submissionId="sub1"
				onClose={vi.fn()}
				onGraded={vi.fn()}
			/>,
		);

		expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
		expect(screen.getByText("Here is my write-up.")).toBeInTheDocument();
		expect(screen.getByText("Code quality")).toBeInTheDocument();
	});

	it("falls back to a manual score field when there's no rubric", async () => {
		getSubmissionForGradingMock.mockResolvedValue(submission({ rubric: [] }));
		renderWithProviders(
			<GradeSubmissionDialog
				submissionId="sub1"
				onClose={vi.fn()}
				onGraded={vi.fn()}
			/>,
		);
		expect(await screen.findByText("Score %")).toBeInTheDocument();
	});

	it("shows the AI draft button only for ai_assisted grading", async () => {
		getSubmissionForGradingMock.mockResolvedValue(
			submission({ gradingType: "ai_assisted" }),
		);
		renderWithProviders(
			<GradeSubmissionDialog
				submissionId="sub1"
				onClose={vi.fn()}
				onGraded={vi.fn()}
			/>,
		);
		expect(
			await screen.findByRole("button", { name: /Draft grade with AI/ }),
		).toBeInTheDocument();
	});

	it("saves the grade, invokes onGraded and onClose", async () => {
		getSubmissionForGradingMock.mockResolvedValue(submission());
		gradeSubmissionMock.mockResolvedValue({ ok: true });
		const onGraded = vi.fn();
		const onClose = vi.fn();
		const user = userEvent.setup();
		renderWithProviders(
			<GradeSubmissionDialog
				submissionId="sub1"
				onClose={onClose}
				onGraded={onGraded}
			/>,
		);
		await screen.findByText("Ada Lovelace");

		await user.click(screen.getByRole("button", { name: "Save grade" }));

		await waitFor(() => {
			expect(gradeSubmissionMock).toHaveBeenCalledWith(
				"sub1",
				expect.objectContaining({
					rubricScores: [{ criterionId: "r1", points: 0 }],
				}),
			);
		});
		expect(onGraded).toHaveBeenCalled();
		expect(onClose).toHaveBeenCalled();
	});

	it("shows a load-failed message instead of an infinite spinner when the submission fails to fetch", async () => {
		getSubmissionForGradingMock.mockRejectedValue(
			new Error("You do not own this content"),
		);
		renderWithProviders(
			<GradeSubmissionDialog
				submissionId="sub1"
				onClose={vi.fn()}
				onGraded={vi.fn()}
			/>,
		);

		expect(
			await screen.findByText("Submission could not be loaded"),
		).toBeInTheDocument();
		expect(screen.getByText("You do not own this content")).toBeInTheDocument();
	});

	it("closes on Escape", async () => {
		getSubmissionForGradingMock.mockResolvedValue(submission());
		const onClose = vi.fn();
		const user = userEvent.setup();
		renderWithProviders(
			<GradeSubmissionDialog
				submissionId="sub1"
				onClose={onClose}
				onGraded={vi.fn()}
			/>,
		);
		await screen.findByText("Ada Lovelace");

		await user.keyboard("{Escape}");
		expect(onClose).toHaveBeenCalled();
	});
});
