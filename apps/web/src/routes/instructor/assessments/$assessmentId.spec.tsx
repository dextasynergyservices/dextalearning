// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssessmentDetail } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const {
	useSessionMock,
	getAssessmentMock,
	addQuestionMock,
	updateQuestionMock,
	deleteQuestionMock,
	deleteAssessmentMock,
	generateQuestionsMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getAssessmentMock: vi.fn(),
	addQuestionMock: vi.fn(),
	updateQuestionMock: vi.fn(),
	deleteQuestionMock: vi.fn(),
	deleteAssessmentMock: vi.fn(),
	generateQuestionsMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getAssessment: getAssessmentMock,
		addQuestion: addQuestionMock,
		updateQuestion: updateQuestionMock,
		deleteQuestion: deleteQuestionMock,
		deleteAssessment: deleteAssessmentMock,
		generateQuestions: generateQuestionsMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function assessmentDetail(
	overrides: Partial<AssessmentDetail> = {},
): AssessmentDetail {
	return {
		id: "a1",
		scope: "course_final",
		type: "quiz",
		title: "Final assessment",
		passMark: 70,
		timeLimitMinutes: null,
		lessonId: null,
		moduleId: null,
		courseId: "c1",
		pathId: null,
		cohortId: null,
		maxRetakes: null,
		retakeCooldownHours: null,
		questionPoolSize: null,
		shuffleQuestions: false,
		shuffleAnswers: false,
		anticheatTabSwitchLimit: 3,
		anticheatFullscreenRequired: false,
		anticheatCameraRequired: false,
		anticheatCopyPasteBlocked: false,
		anticheatTimePerQuestionFlagSeconds: 2,
		gradingType: "auto",
		scheduledAt: null,
		dueAt: null,
		questions: [
			{
				id: "q1",
				type: "mcq",
				body: "What is 2+2?",
				optionsJson: ["3", "4"],
				correctAnswer: "4",
				points: 1,
				orderIndex: 0,
			},
		],
		sourceLessons: [{ id: "l1", title: "Intro", hasTranscript: true }],
		...overrides,
	} as AssessmentDetail;
}

describe("InstructorAssessmentRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getAssessmentMock.mockReset();
		addQuestionMock.mockReset();
		updateQuestionMock.mockReset();
		deleteQuestionMock.mockReset();
		deleteAssessmentMock.mockReset();
		generateQuestionsMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "instructor" } },
			isPending: false,
		});
	});

	it("renders the assessment stats and question list", async () => {
		getAssessmentMock.mockResolvedValue(assessmentDetail());
		renderRoute("/instructor/assessments/a1");

		expect(await screen.findByText("What is 2+2?")).toBeInTheDocument();
		expect(screen.getByText("Multiple choice")).toBeInTheDocument();
	});

	it("shows the no-questions message when empty", async () => {
		getAssessmentMock.mockResolvedValue(assessmentDetail({ questions: [] }));
		renderRoute("/instructor/assessments/a1");

		expect(
			await screen.findByText(
				"No questions yet. Add one or generate from a lesson.",
			),
		).toBeInTheDocument();
	});

	it("adds an MCQ question via the dialog", async () => {
		getAssessmentMock.mockResolvedValue(assessmentDetail({ questions: [] }));
		addQuestionMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/instructor/assessments/a1");
		await screen.findByText(
			"No questions yet. Add one or generate from a lesson.",
		);

		await user.click(screen.getByRole("button", { name: "Add question" }));
		await user.type(
			screen.getByLabelText("Question"),
			"What is the capital of Nigeria?",
		);
		const optionInputs = screen.getAllByPlaceholderText(/Option \d/);
		await user.type(optionInputs[0], "Lagos");
		await user.type(optionInputs[1], "Abuja");
		await user.click(
			screen.getAllByRole("button", { name: "Mark correct" })[1],
		);
		await user.click(screen.getByRole("button", { name: "Save question" }));

		await waitFor(() => {
			expect(addQuestionMock).toHaveBeenCalledWith(
				"a1",
				expect.objectContaining({
					type: "mcq",
					body: "What is the capital of Nigeria?",
					correctAnswer: "Abuja",
					options: ["Lagos", "Abuja"],
				}),
			);
		});
	});

	it("edits an existing question", async () => {
		getAssessmentMock.mockResolvedValue(assessmentDetail());
		updateQuestionMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/instructor/assessments/a1");
		await screen.findByText("What is 2+2?");

		await user.click(screen.getByRole("button", { name: "Edit" }));
		expect(await screen.findByText("Edit question")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Save question" }));

		await waitFor(() => {
			expect(updateQuestionMock).toHaveBeenCalledWith(
				"q1",
				expect.objectContaining({ body: "What is 2+2?" }),
			);
		});
	});

	it("deletes a question", async () => {
		getAssessmentMock.mockResolvedValue(assessmentDetail());
		deleteQuestionMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/instructor/assessments/a1");
		await screen.findByText("What is 2+2?");

		// The header's assessment-level "Delete" and the question row's
		// icon-only "Delete" share the same accessible name.
		const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
		await user.click(deleteButtons[deleteButtons.length - 1]);

		await waitFor(() => {
			expect(deleteQuestionMock).toHaveBeenCalledWith("q1");
		});
	});

	it("generates questions with AI from a lesson with a transcript", async () => {
		getAssessmentMock.mockResolvedValue(assessmentDetail({ questions: [] }));
		generateQuestionsMock.mockResolvedValue([{}, {}]);
		const user = userEvent.setup();
		renderRoute("/instructor/assessments/a1");
		await screen.findByText(
			"No questions yet. Add one or generate from a lesson.",
		);

		await user.click(screen.getByRole("button", { name: /Generate with AI/ }));
		expect(
			await screen.findByText("Generate questions with AI"),
		).toBeInTheDocument();

		// AssessmentSettingsPanel also renders a "Grading" select in the
		// background — target the dialog's own labeled "Source lesson" select.
		await user.selectOptions(screen.getByLabelText("Source lesson"), "l1");
		const generateButtons = screen.getAllByRole("button", {
			name: /Generate with AI/,
		});
		await user.click(generateButtons[generateButtons.length - 1]);

		await waitFor(() => {
			expect(generateQuestionsMock).toHaveBeenCalledWith(
				"a1",
				expect.objectContaining({ lessonId: "l1" }),
			);
		});
	});

	it("deletes the whole assessment after confirming", async () => {
		const { toast } = await import("sonner");
		getAssessmentMock.mockResolvedValue(assessmentDetail());
		deleteAssessmentMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/instructor/assessments/a1");
		await screen.findByText("What is 2+2?");

		const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
		await user.click(deleteButtons[0]);
		expect(await screen.findByText("Delete assessment?")).toBeInTheDocument();

		const confirmButtons = screen.getAllByRole("button", { name: "Delete" });
		await user.click(confirmButtons[confirmButtons.length - 1]);

		await waitFor(() => {
			expect(deleteAssessmentMock).toHaveBeenCalledWith("a1");
		});
		expect(toast.success).toHaveBeenCalledWith("Assessment deleted");
	});
});
