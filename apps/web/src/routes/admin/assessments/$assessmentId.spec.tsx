// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssessmentDetail } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, getAssessmentMock } = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getAssessmentMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return { ...actual, getAssessment: getAssessmentMock };
});

function assessmentDetail(): AssessmentDetail {
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
		retakeLockoutDays: null,
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
		questions: [],
		sourceLessons: [],
	} as AssessmentDetail;
}

describe("AdminAssessmentRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getAssessmentMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "admin" } },
			isPending: false,
		});
	});

	it("renders the admin studio chrome for the assessment editor", async () => {
		getAssessmentMock.mockResolvedValue(assessmentDetail());
		renderRoute("/admin/assessments/a1");

		expect((await screen.findAllByText("Admin Studio")).length).toBeGreaterThan(
			0,
		);
		expect(
			(await screen.findAllByText("Final assessment")).length,
		).toBeGreaterThan(0);
	});
});
