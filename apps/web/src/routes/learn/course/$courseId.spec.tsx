// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseProgress } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, getCourseProgressMock, getMyProfileMock } = vi.hoisted(
	() => ({
		useSessionMock: vi.fn(),
		getCourseProgressMock: vi.fn(),
		getMyProfileMock: vi.fn(),
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
		getCourseProgress: getCourseProgressMock,
		getMyProfile: getMyProfileMock,
	};
});

function progress(overrides: Partial<CourseProgress> = {}): CourseProgress {
	return {
		course: {
			id: "c1",
			title: "React Basics",
			description: "<p>Learn React.</p>",
			thumbnailUrl: null,
		},
		modules: [
			{
				id: "m1",
				title: "Getting started",
				lessons: [
					{
						id: "l1",
						title: "Intro",
						contentType: "video",
						done: true,
						percent: 100,
					},
					{
						id: "l2",
						title: "Setup",
						contentType: "video",
						done: false,
						percent: 0,
					},
				],
				assessment: null,
			},
		],
		projects: [],
		finalAssessment: null,
		summary: {
			lessonsDone: 1,
			lessonsTotal: 2,
			allLessonsDone: false,
			allModuleAssessmentsPassed: true,
			finalAssessmentPassed: true,
			allProjectsPassed: true,
			isComplete: false,
			percent: 50,
		},
		...overrides,
	};
}

describe("CourseHubRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getCourseProgressMock.mockReset();
		getMyProfileMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "learner" } },
			isPending: false,
		});
		getMyProfileMock.mockResolvedValue({ image: null });
	});

	it("renders the course title, progress and lesson list", async () => {
		getCourseProgressMock.mockResolvedValue(progress());
		renderRoute("/learn/course/c1");

		expect(await screen.findByText("Intro")).toBeInTheDocument();
		expect(screen.getByText("Setup")).toBeInTheDocument();
		expect(screen.getByText("1/2 lessons complete")).toBeInTheDocument();
	});

	it("shows 'Continue learning' as the CTA when some lessons are done", async () => {
		getCourseProgressMock.mockResolvedValue(progress());
		renderRoute("/learn/course/c1");

		expect(
			await screen.findByRole("link", { name: /Continue learning/ }),
		).toHaveAttribute("href", "/learn/lesson/l2");
	});

	it("shows the 'Complete!' badge when the course is finished", async () => {
		getCourseProgressMock.mockResolvedValue(
			progress({
				summary: {
					lessonsDone: 2,
					lessonsTotal: 2,
					allLessonsDone: true,
					allModuleAssessmentsPassed: true,
					finalAssessmentPassed: true,
					allProjectsPassed: true,
					isComplete: true,
					percent: 100,
				},
			}),
		);
		renderRoute("/learn/course/c1");

		expect(await screen.findByText("Complete!")).toBeInTheDocument();
	});

	it("renders a project entry with a 'Passed' badge", async () => {
		getCourseProgressMock.mockResolvedValue(
			progress({
				projects: [
					{
						id: "p1",
						title: "Build a todo app",
						gradingType: "manual",
						passed: true,
					},
				],
			}),
		);
		renderRoute("/learn/course/c1");

		expect(await screen.findByText("Build a todo app")).toBeInTheDocument();
		expect(screen.getByText("Passed")).toBeInTheDocument();
	});

	// ── Finals open last (§4.3) ─────────────────────────────────────────────
	describe("final assessment + project gating", () => {
		const withFinals = (overrides: Partial<CourseProgress> = {}) =>
			progress({
				finalAssessment: { id: "fa1", passed: false, required: true },
				projects: [
					{
						id: "p1",
						title: "Capstone",
						gradingType: "manual",
						passed: false,
					},
				],
				...overrides,
			});

		it("locks the final and the project while lessons are unfinished", async () => {
			// Fixture is 1 of 2 lessons done.
			getCourseProgressMock.mockResolvedValue(withFinals());
			renderRoute("/learn/course/c1");

			// "Final assessment" also appears in the completion sidebar, so assert
			// on the row's own lock state rather than the bare label.
			expect(await screen.findAllByText("Locked")).toHaveLength(2);
			// Neither is a link — a lock the learner can click through is no lock.
			expect(
				screen.queryByRole("link", { name: /Final assessment/ }),
			).not.toBeInTheDocument();
			expect(
				screen.queryByRole("link", { name: /Capstone/ }),
			).not.toBeInTheDocument();
		});

		it("says why it's locked, naming the work that's left", async () => {
			getCourseProgressMock.mockResolvedValue(withFinals());
			renderRoute("/learn/course/c1");

			expect(
				await screen.findAllByText(
					"Finish all 2 lessons to unlock this. 1 done so far.",
				),
			).toHaveLength(2);
		});

		it("points at the module quizzes when the lessons are done but a quiz isn't passed", async () => {
			getCourseProgressMock.mockResolvedValue(
				withFinals({
					summary: {
						lessonsDone: 2,
						lessonsTotal: 2,
						allLessonsDone: true,
						allModuleAssessmentsPassed: false,
						finalAssessmentPassed: false,
						allProjectsPassed: false,
						isComplete: false,
						percent: 80,
					},
				}),
			);
			renderRoute("/learn/course/c1");

			expect(
				await screen.findAllByText("Pass every module quiz to unlock this."),
			).toHaveLength(2);
		});

		it("opens both once the lessons and module quizzes are done", async () => {
			getCourseProgressMock.mockResolvedValue(
				withFinals({
					summary: {
						lessonsDone: 2,
						lessonsTotal: 2,
						allLessonsDone: true,
						allModuleAssessmentsPassed: true,
						finalAssessmentPassed: false,
						allProjectsPassed: false,
						isComplete: false,
						percent: 90,
					},
				}),
			);
			renderRoute("/learn/course/c1");

			expect(
				await screen.findByRole("link", { name: /Final assessment/ }),
			).toHaveAttribute("href", "/learn/assessment/fa1");
			expect(screen.getByRole("link", { name: /Capstone/ })).toHaveAttribute(
				"href",
				"/learn/project/p1",
			);
			expect(screen.queryByText("Locked")).not.toBeInTheDocument();
		});

		it("never locks something already passed", async () => {
			getCourseProgressMock.mockResolvedValue(
				withFinals({
					finalAssessment: { id: "fa1", passed: true, required: true },
				}),
			);
			renderRoute("/learn/course/c1");

			// Lessons are still unfinished, but a passed final stays reachable.
			expect(
				await screen.findByRole("link", { name: /Final assessment/ }),
			).toBeInTheDocument();
		});
	});
});
