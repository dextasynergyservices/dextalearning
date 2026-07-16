// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssessmentDetail } from "@/lib/content-api";
import { renderWithProviders } from "@/test/render";
import { AssessmentSettingsPanel } from "./assessment-settings-panel";

const { updateAssessmentMock } = vi.hoisted(() => ({
	updateAssessmentMock: vi.fn(),
}));

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return { ...actual, updateAssessment: updateAssessmentMock };
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function assessment(
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
		questions: [],
		sourceLessons: [],
		...overrides,
	} as AssessmentDetail;
}

describe("AssessmentSettingsPanel", () => {
	beforeEach(() => {
		updateAssessmentMock.mockReset();
	});

	it("renders the pass mark, timing and anti-cheat fields", () => {
		renderWithProviders(<AssessmentSettingsPanel assessment={assessment()} />);
		expect(screen.getByText("Assessment settings")).toBeInTheDocument();
		// Real locale key overrides the component's "Pass mark %" fallback text.
		expect(screen.getByText("Pass mark")).toBeInTheDocument();
		expect(screen.getByText("Anti-cheat")).toBeInTheDocument();
		expect(screen.getByText("Require camera monitoring")).toBeInTheDocument();
	});

	it("toggles an anti-cheat setting", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssessmentSettingsPanel assessment={assessment()} />);

		const fullscreenToggle = screen.getByText("Require fullscreen");
		await user.click(fullscreenToggle);

		updateAssessmentMock.mockResolvedValue(assessment());
		await user.click(screen.getByRole("button", { name: "Save settings" }));

		await waitFor(() => {
			expect(updateAssessmentMock).toHaveBeenCalledWith(
				"a1",
				expect.objectContaining({ anticheatFullscreenRequired: true }),
			);
		});
	});

	it("saves settings with the current field values and shows a success toast", async () => {
		const { toast } = await import("sonner");
		updateAssessmentMock.mockResolvedValue(assessment());
		const user = userEvent.setup();
		renderWithProviders(<AssessmentSettingsPanel assessment={assessment()} />);

		await user.click(screen.getByRole("button", { name: "Save settings" }));

		await waitFor(() => {
			expect(updateAssessmentMock).toHaveBeenCalledWith(
				"a1",
				expect.objectContaining({
					passMark: 70,
					timeLimitMinutes: null,
					maxRetakes: null,
					gradingType: "auto",
				}),
			);
		});
		expect(toast.success).toHaveBeenCalledWith("Settings saved");
	});

	it("shows an error toast when saving fails", async () => {
		const { toast } = await import("sonner");
		updateAssessmentMock.mockRejectedValue(new Error("Network error"));
		const user = userEvent.setup();
		renderWithProviders(<AssessmentSettingsPanel assessment={assessment()} />);

		await user.click(screen.getByRole("button", { name: "Save settings" }));

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith("Network error");
		});
	});

	// ── Retry rules are for finals only (§4.4.1) ────────────────────────────
	describe("retry policy visibility", () => {
		it("offers the retry rules on a final assessment", () => {
			renderWithProviders(
				<AssessmentSettingsPanel
					assessment={assessment({ scope: "course_final" })}
				/>,
			);
			expect(screen.getByText("Retry policy")).toBeInTheDocument();
			expect(screen.getByText("Max retakes")).toBeInTheDocument();
		});

		it.each([
			"lesson_pre",
			"lesson_post",
			"module",
		] as const)("hides the retry rules on a %s quiz — it's unlimited practice", (scope) => {
			renderWithProviders(
				<AssessmentSettingsPanel assessment={assessment({ scope })} />,
			);
			expect(screen.queryByText("Retry policy")).not.toBeInTheDocument();
			expect(screen.queryByText("Max retakes")).not.toBeInTheDocument();
			expect(screen.getByText(/retakes are unlimited/i)).toBeInTheDocument();
		});

		it("never sends retry fields when saving a formative quiz", async () => {
			updateAssessmentMock.mockResolvedValue({});
			const user = userEvent.setup();
			renderWithProviders(
				<AssessmentSettingsPanel
					assessment={assessment({ scope: "module" })}
				/>,
			);

			await user.click(screen.getByRole("button", { name: "Save settings" }));

			await waitFor(() => {
				expect(updateAssessmentMock).toHaveBeenCalled();
			});
			const body = updateAssessmentMock.mock.calls[0][1];
			expect(body).not.toHaveProperty("maxRetakes");
			expect(body).not.toHaveProperty("retakeCooldownHours");
			expect(body).not.toHaveProperty("retakeLockoutDays");
		});
	});
});
