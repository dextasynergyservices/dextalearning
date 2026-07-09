// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { LearnerDetailModal } from "./learner-detail-modal";

const { getLearnerDetailMock } = vi.hoisted(() => ({
	getLearnerDetailMock: vi.fn(),
}));

vi.mock("@/lib/analytics-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/analytics-api")>();
	return { ...actual, getLearnerDetail: getLearnerDetailMock };
});

describe("LearnerDetailModal", () => {
	beforeEach(() => getLearnerDetailMock.mockReset());

	it("shows a course learner's lessons (with quiz scores) and assessment bests", async () => {
		getLearnerDetailMock.mockResolvedValue({
			entity: { id: "c1", title: "React Basics", type: "course" },
			learner: {
				userId: "u1",
				name: "Chinwe Okafor",
				email: "c@example.com",
				progressPercent: 60,
				isComplete: false,
				completedAt: null,
			},
			lessons: [
				{ id: "l1", title: "Intro", completed: true, postQuizScore: 80 },
				{ id: "l2", title: "Setup", completed: false, postQuizScore: null },
			],
			assessments: [
				{
					id: "a1",
					title: "Final",
					scope: "course_final",
					bestScore: 90,
					passed: true,
				},
			],
		});

		renderWithProviders(
			<LearnerDetailModal
				type="course"
				entityId="c1"
				learnerId="u1"
				learnerName="Chinwe Okafor"
				onClose={vi.fn()}
			/>,
		);

		expect(await screen.findByText("Intro")).toBeInTheDocument();
		expect(screen.getByText("Setup")).toBeInTheDocument();
		expect(screen.getByText("80%")).toBeInTheDocument(); // post-quiz score
		expect(screen.getByText("Final")).toBeInTheDocument();
		expect(screen.getByText("90%")).toBeInTheDocument(); // assessment best
		expect(screen.getByText("Student performance")).toBeInTheDocument();
	});

	it("shows per-component progress for a path learner", async () => {
		getLearnerDetailMock.mockResolvedValue({
			entity: { id: "p1", title: "Fullstack", type: "path" },
			learner: {
				userId: "u1",
				name: "Femi Ade",
				email: "f@example.com",
				progressPercent: 50,
				isComplete: false,
				completedAt: null,
			},
			components: [
				{
					id: "c1",
					title: "HTML",
					type: "course",
					progressPercent: 100,
					isComplete: true,
				},
				{
					id: "c2",
					title: "CSS",
					type: "course",
					progressPercent: 0,
					isComplete: false,
				},
			],
		});

		renderWithProviders(
			<LearnerDetailModal
				type="path"
				entityId="p1"
				learnerId="u1"
				learnerName="Femi Ade"
				onClose={vi.fn()}
			/>,
		);
		expect(await screen.findByText("HTML")).toBeInTheDocument();
		expect(screen.getByText("CSS")).toBeInTheDocument();
		expect(screen.getByText("Courses in this track")).toBeInTheDocument();
	});

	it("closes on Escape", async () => {
		getLearnerDetailMock.mockResolvedValue({
			entity: { id: "c1", title: "React Basics", type: "course" },
			learner: {
				userId: "u1",
				name: "Chinwe Okafor",
				email: "c@example.com",
				progressPercent: 0,
				isComplete: false,
				completedAt: null,
			},
			lessons: [],
			assessments: [],
		});
		const onClose = vi.fn();
		const user = userEvent.setup();
		renderWithProviders(
			<LearnerDetailModal
				type="course"
				entityId="c1"
				learnerId="u1"
				learnerName="Chinwe Okafor"
				onClose={onClose}
			/>,
		);
		await screen.findByText("Student performance");
		await user.keyboard("{Escape}");
		expect(onClose).toHaveBeenCalled();
	});
});
