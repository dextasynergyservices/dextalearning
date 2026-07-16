// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PathProgress } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, getPathProgressMock, getMyProfileMock } = vi.hoisted(
	() => ({
		useSessionMock: vi.fn(),
		getPathProgressMock: vi.fn(),
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
		getPathProgress: getPathProgressMock,
		getMyProfile: getMyProfileMock,
	};
});

function progress(overrides: Partial<PathProgress> = {}): PathProgress {
	return {
		path: { id: "p1", title: "Full Stack Path" },
		courses: [
			{
				id: "c1",
				title: "React Basics",
				isRequired: true,
				isComplete: true,
				percent: 100,
			},
			{
				id: "c2",
				title: "Node Basics",
				isRequired: true,
				isComplete: false,
				percent: 30,
			},
		],
		projects: [],
		finalAssessment: null,
		summary: {
			coursesTotal: 2,
			coursesComplete: 1,
			allCoursesComplete: false,
			finalAssessmentPassed: true,
			allProjectsPassed: true,
			isComplete: false,
			percent: 50,
		},
		...overrides,
	};
}

describe("PathProgressRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getPathProgressMock.mockReset();
		getMyProfileMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "learner" } },
			isPending: false,
		});
		getMyProfileMock.mockResolvedValue({ image: null });
	});

	it("renders the path title, courses and progress", async () => {
		getPathProgressMock.mockResolvedValue(progress());
		renderRoute("/learn/path/p1");

		expect(await screen.findByText("React Basics")).toBeInTheDocument();
		expect(screen.getByText("Node Basics")).toBeInTheDocument();
		expect(screen.getByText("1/2 courses complete")).toBeInTheDocument();
	});

	it("links 'Continue learning' to the next incomplete course", async () => {
		getPathProgressMock.mockResolvedValue(progress());
		renderRoute("/learn/path/p1");

		expect(
			await screen.findByRole("link", { name: /Continue learning/ }),
		).toHaveAttribute("href", "/learn/course/c2");
	});

	it("shows the 'Complete!' badge when the whole path is finished", async () => {
		getPathProgressMock.mockResolvedValue(
			progress({
				summary: {
					coursesTotal: 2,
					coursesComplete: 2,
					allCoursesComplete: true,
					finalAssessmentPassed: true,
					allProjectsPassed: true,
					isComplete: true,
					percent: 100,
				},
			}),
		);
		renderRoute("/learn/path/p1");

		expect(await screen.findByText("Complete!")).toBeInTheDocument();
	});

	it("marks a non-required course as optional", async () => {
		getPathProgressMock.mockResolvedValue(
			progress({
				courses: [
					{
						id: "c1",
						title: "Bonus Course",
						isRequired: false,
						isComplete: false,
						percent: 0,
					},
				],
			}),
		);
		renderRoute("/learn/path/p1");

		expect(await screen.findByText("Bonus Course")).toBeInTheDocument();
		expect(screen.getByText("· Optional")).toBeInTheDocument();
	});

	// ── The path's own finals (§4.3.1) ──────────────────────────────────────
	describe("path final assessment + projects", () => {
		const withFinals = (overrides: Partial<PathProgress> = {}) =>
			progress({
				finalAssessment: { id: "pfa1", passed: false, required: true },
				projects: [
					{
						id: "pp1",
						title: "Path capstone",
						gradingType: "manual",
						passed: false,
					},
				],
				...overrides,
			});

		it("surfaces the path final and projects on the hub", async () => {
			getPathProgressMock.mockResolvedValue(
				withFinals({
					summary: {
						coursesTotal: 2,
						coursesComplete: 2,
						allCoursesComplete: true,
						finalAssessmentPassed: false,
						allProjectsPassed: false,
						isComplete: false,
						percent: 60,
					},
				}),
			);
			renderRoute("/learn/path/p1");

			expect(
				await screen.findByRole("link", { name: /Path final assessment/ }),
			).toHaveAttribute("href", "/learn/assessment/pfa1");
			expect(
				screen.getByRole("link", { name: /Path capstone/ }),
			).toHaveAttribute("href", "/learn/project/pp1");
		});

		it("locks them while the path's courses are unfinished", async () => {
			// Fixture default: 1 of 2 courses complete.
			getPathProgressMock.mockResolvedValue(withFinals());
			renderRoute("/learn/path/p1");

			expect(await screen.findAllByText("Locked")).toHaveLength(2);
			expect(
				screen.queryByRole("link", { name: /Path final assessment/ }),
			).not.toBeInTheDocument();
			expect(
				screen.queryByRole("link", { name: /Path capstone/ }),
			).not.toBeInTheDocument();
			expect(
				screen.getAllByText(
					"Finish 1 more course in this path to unlock this.",
				),
			).toHaveLength(2);
		});

		it("renders no finals section when the path has none", async () => {
			getPathProgressMock.mockResolvedValue(progress());
			renderRoute("/learn/path/p1");

			expect(await screen.findByText("React Basics")).toBeInTheDocument();
			expect(
				screen.queryByText("Path final assessment"),
			).not.toBeInTheDocument();
			expect(screen.queryByText("Locked")).not.toBeInTheDocument();
		});
	});
});
