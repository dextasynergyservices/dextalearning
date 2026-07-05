// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssessmentSummary } from "@/lib/content-api";
import { renderWithRouter } from "@/test/render";
import { AssessmentLauncher } from "./assessment-launcher";

const { navigateMock, listAssessmentsMock, createAssessmentMock } = vi.hoisted(
	() => ({
		navigateMock: vi.fn(),
		listAssessmentsMock: vi.fn(),
		createAssessmentMock: vi.fn(),
	}),
);

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		listAssessments: listAssessmentsMock,
		createAssessment: createAssessmentMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function assessmentSummary(
	overrides: Partial<AssessmentSummary> = {},
): AssessmentSummary {
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
		_count: { questions: 5 },
		...overrides,
	};
}

describe("AssessmentLauncher", () => {
	beforeEach(() => {
		navigateMock.mockReset();
		listAssessmentsMock.mockReset();
		createAssessmentMock.mockReset();
	});

	it("shows 'Create assessment' when none exists for the scope", async () => {
		listAssessmentsMock.mockResolvedValue([]);
		renderWithRouter(
			<AssessmentLauncher
				scope="course_final"
				parent={{ courseId: "c1" }}
				area="instructor"
			/>,
		);
		expect(
			await screen.findByRole("button", { name: /Create assessment/ }),
		).toBeInTheDocument();
	});

	it("shows the existing assessment's title and question count", async () => {
		listAssessmentsMock.mockResolvedValue([assessmentSummary()]);
		renderWithRouter(
			<AssessmentLauncher
				scope="course_final"
				parent={{ courseId: "c1" }}
				area="instructor"
			/>,
		);
		expect(await screen.findByText("Final assessment")).toBeInTheDocument();
		expect(screen.getByText("5 questions · 70% to pass")).toBeInTheDocument();
	});

	it("opens the editor for an existing assessment", async () => {
		listAssessmentsMock.mockResolvedValue([assessmentSummary()]);
		const user = userEvent.setup();
		renderWithRouter(
			<AssessmentLauncher
				scope="course_final"
				parent={{ courseId: "c1" }}
				area="admin"
			/>,
		);
		await user.click(await screen.findByText("Final assessment"));

		expect(navigateMock).toHaveBeenCalledWith({
			to: "/admin/assessments/$assessmentId",
			params: { assessmentId: "a1" },
		});
	});

	it("creates a new assessment and opens its editor", async () => {
		listAssessmentsMock.mockResolvedValue([]);
		createAssessmentMock.mockResolvedValue(assessmentSummary({ id: "a2" }));
		const user = userEvent.setup();
		renderWithRouter(
			<AssessmentLauncher
				scope="course_final"
				parent={{ courseId: "c1" }}
				area="instructor"
			/>,
		);

		await user.click(
			await screen.findByRole("button", { name: /Create assessment/ }),
		);

		await waitFor(() => {
			expect(createAssessmentMock).toHaveBeenCalledWith({
				scope: "course_final",
				courseId: "c1",
			});
		});
		expect(navigateMock).toHaveBeenCalledWith({
			to: "/instructor/assessments/$assessmentId",
			params: { assessmentId: "a2" },
		});
	});

	it("uses a custom create label when provided", async () => {
		listAssessmentsMock.mockResolvedValue([]);
		renderWithRouter(
			<AssessmentLauncher
				scope="lesson_pre"
				parent={{ lessonId: "l1" }}
				area="instructor"
				createLabel="Add pre-lesson quiz"
			/>,
		);
		expect(
			await screen.findByRole("button", { name: /Add pre-lesson quiz/ }),
		).toBeInTheDocument();
	});
});
