// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	AttemptInfo,
	AttemptResult,
	AttemptState,
} from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const {
	useSessionMock,
	getAssessmentInfoMock,
	startAttemptMock,
	submitAttemptMock,
	saveAttemptAnswerMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getAssessmentInfoMock: vi.fn(),
	startAttemptMock: vi.fn(),
	submitAttemptMock: vi.fn(),
	saveAttemptAnswerMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getAssessmentInfo: getAssessmentInfoMock,
		startAttempt: startAttemptMock,
		submitAttempt: submitAttemptMock,
		saveAttemptAnswer: saveAttemptAnswerMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

function anticheat() {
	return {
		tabSwitchLimit: 3,
		fullscreenRequired: false,
		cameraRequired: false,
		copyPasteBlocked: false,
	};
}

function info(overrides: Partial<AttemptInfo> = {}): AttemptInfo {
	return {
		id: "a1",
		title: "Module quiz",
		scope: "module",
		passMark: 70,
		timeLimitMinutes: null,
		questionCount: 1,
		prerequisitesMet: true,
		hasRetryPolicy: false,
		maxRetakes: null,
		retakeCooldownHours: null,
		retakeLockoutDays: null,
		lockedUntil: null,
		anticheat: anticheat(),
		inProgressAttemptId: null,
		canStart: true,
		attemptsUsed: 0,
		retakesRemaining: null,
		alreadyPassed: false,
		bestScore: 0,
		cooldownUntil: null,
		lastAttemptId: null,
		...overrides,
	};
}

function attemptState(overrides: Partial<AttemptState> = {}): AttemptState {
	return {
		status: "in_progress",
		attemptId: "att1",
		assessmentId: "a1",
		title: "Module quiz",
		attemptNumber: 1,
		timeLimitMinutes: null,
		remainingSeconds: null,
		passMark: 70,
		anticheat: anticheat(),
		questions: [
			{
				id: "q1",
				type: "mcq",
				body: "What is 2+2?",
				points: 1,
				options: ["3", "4"],
			},
		],
		answers: {},
		...overrides,
	};
}

function result(overrides: Partial<AttemptResult> = {}): AttemptResult {
	return {
		status: "submitted",
		attemptId: "att1",
		assessmentId: "a1",
		title: "Module quiz",
		attemptNumber: 1,
		submittedAt: new Date().toISOString(),
		autoSubmitted: false,
		score: 100,
		previousBest: null,
		delta: null,
		passed: true,
		passMark: 70,
		integrityScore: 100,
		flagCount: 0,
		review: [
			{
				id: "q1",
				type: "mcq",
				body: "What is 2+2?",
				options: ["3", "4"],
				points: 1,
				yourAnswer: "4",
				correctAnswer: "4",
				correct: true,
			},
		],
		...overrides,
	};
}

describe("TakeAssessmentRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getAssessmentInfoMock.mockReset();
		startAttemptMock.mockReset();
		submitAttemptMock.mockReset();
		saveAttemptAnswerMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "learner" } },
			isPending: false,
		});
		saveAttemptAnswerMock.mockResolvedValue({});
	});

	it("renders the intro screen with question count, pass mark and time", async () => {
		getAssessmentInfoMock.mockResolvedValue(info());
		renderRoute("/learn/assessment/a1");

		expect(await screen.findByText("Module quiz")).toBeInTheDocument();
		expect(screen.getByText("70%")).toBeInTheDocument();
		expect(screen.getByText("Untimed")).toBeInTheDocument();
	});

	it("shows the blocked-reason notice instead of a start button when the learner can't start", async () => {
		getAssessmentInfoMock.mockResolvedValue(
			info({ canStart: false, reason: "already_passed" }),
		);
		renderRoute("/learn/assessment/a1");

		expect(
			await screen.findByText("You've already passed this assessment."),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Start assessment" }),
		).not.toBeInTheDocument();
	});

	it("starts an attempt, answers a question and submits", async () => {
		getAssessmentInfoMock.mockResolvedValue(info());
		startAttemptMock.mockResolvedValue(attemptState());
		submitAttemptMock.mockResolvedValue(result());
		const user = userEvent.setup();
		renderRoute("/learn/assessment/a1");

		await user.click(
			await screen.findByRole("button", { name: "Start assessment" }),
		);
		await screen.findByText("What is 2+2?");

		await user.click(screen.getByRole("button", { name: "4" }));
		await user.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() => {
			expect(submitAttemptMock).toHaveBeenCalledWith("att1", { q1: "4" });
		});
		expect(await screen.findByText("Passed")).toBeInTheDocument();
		expect(screen.getByText("100%")).toBeInTheDocument();
	});

	it("shows 'Not passed' and the correct answer for a failing result", async () => {
		getAssessmentInfoMock.mockResolvedValue(info());
		startAttemptMock.mockResolvedValue(attemptState());
		submitAttemptMock.mockResolvedValue(
			result({
				score: 0,
				passed: false,
				review: [
					{
						id: "q1",
						type: "mcq",
						body: "What is 2+2?",
						options: ["3", "4"],
						points: 1,
						yourAnswer: "3",
						correctAnswer: "4",
						correct: false,
					},
				],
			}),
		);
		const user = userEvent.setup();
		renderRoute("/learn/assessment/a1");

		await user.click(
			await screen.findByRole("button", { name: "Start assessment" }),
		);
		await screen.findByText("What is 2+2?");
		await user.click(screen.getByRole("button", { name: "3" }));
		await user.click(screen.getByRole("button", { name: "Submit" }));

		expect(await screen.findByText("Not passed")).toBeInTheDocument();
		expect(screen.getByText("4")).toBeInTheDocument();
	});
});
