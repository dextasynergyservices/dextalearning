// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CohortProgress } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, getCohortProgressMock, getMyProfileMock } = vi.hoisted(
	() => ({
		useSessionMock: vi.fn(),
		getCohortProgressMock: vi.fn(),
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
		getCohortProgress: getCohortProgressMock,
		getMyProfile: getMyProfileMock,
	};
});

function progress(overrides: Partial<CohortProgress> = {}): CohortProgress {
	return {
		cohort: { id: "co1", title: "January Cohort" },
		courses: [
			{ id: "c1", title: "React Basics", isComplete: false, percent: 40 },
		],
		paths: [],
		assessments: [],
		projects: [],
		summary: {
			coursesTotal: 1,
			coursesComplete: 0,
			isComplete: false,
			percent: 40,
		},
		...overrides,
	} as CohortProgress;
}

describe("CohortProgressRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getCohortProgressMock.mockReset();
		getMyProfileMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "learner" } },
			isPending: false,
		});
		getMyProfileMock.mockResolvedValue({ image: null });
	});

	it("renders the cohort title and its courses", async () => {
		getCohortProgressMock.mockResolvedValue(progress());
		renderRoute("/learn/cohort/co1");

		// "January Cohort" also appears in the LearnerShell's sr-only mobile h1.
		expect(
			(await screen.findAllByText("January Cohort")).length,
		).toBeGreaterThan(0);
		expect(screen.getByText("React Basics")).toBeInTheDocument();
	});

	it("renders assessments and projects sections with pass state", async () => {
		getCohortProgressMock.mockResolvedValue(
			progress({
				assessments: [{ id: "a1", title: "Cohort quiz", passed: true }],
				projects: [
					{ id: "p1", title: "Capstone", gradingType: "manual", passed: false },
				],
			}),
		);
		renderRoute("/learn/cohort/co1");

		expect(await screen.findByText("Cohort quiz")).toBeInTheDocument();
		expect(screen.getByText("Passed")).toBeInTheDocument();
		expect(screen.getByText("Capstone")).toBeInTheDocument();
	});

	it("renders the learning paths section when the cohort has paths", async () => {
		getCohortProgressMock.mockResolvedValue(
			progress({
				paths: [
					{
						id: "p1",
						title: "Full Stack Path",
						isComplete: false,
						percent: 20,
					},
				],
			}),
		);
		renderRoute("/learn/cohort/co1");

		expect(await screen.findByText("Learning paths")).toBeInTheDocument();
		expect(screen.getByText("Full Stack Path")).toBeInTheDocument();
	});

	it("shows the 'Complete!' badge when the cohort is finished", async () => {
		getCohortProgressMock.mockResolvedValue(
			progress({
				summary: {
					coursesTotal: 1,
					coursesComplete: 1,
					pathsComplete: 0,
					pathsTotal: 0,
					allAssessmentsPassed: true,
					allProjectsPassed: true,
					isComplete: true,
					percent: 100,
				},
			}),
		);
		renderRoute("/learn/cohort/co1");

		expect(await screen.findByText("Complete!")).toBeInTheDocument();
	});
});
