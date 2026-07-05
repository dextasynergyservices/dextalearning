// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InstructorProfile } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { getInstructorMock } = vi.hoisted(() => ({
	getInstructorMock: vi.fn(),
}));

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return { ...actual, getInstructor: getInstructorMock };
});

function profile(
	overrides: Partial<InstructorProfile> = {},
): InstructorProfile {
	return {
		instructor: {
			id: "i1",
			name: "Ada Lovelace",
			image: null,
			headline: "Senior Engineer",
			bio: "I teach React and TypeScript.",
			expertiseAreas: ["technology"],
		},
		courses: [],
		paths: [],
		cohorts: [],
		...overrides,
	};
}

describe("InstructorProfilePage", () => {
	beforeEach(() => {
		getInstructorMock.mockReset();
	});

	it("renders the instructor's name, headline and bio", async () => {
		getInstructorMock.mockResolvedValue(profile());
		renderRoute("/instructors/i1");

		expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
		expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
		expect(
			screen.getByText("I teach React and TypeScript."),
		).toBeInTheDocument();
	});

	it("shows the empty state when the instructor has no published content", async () => {
		getInstructorMock.mockResolvedValue(profile());
		renderRoute("/instructors/i1");

		expect(
			await screen.findByText("Nothing published yet"),
		).toBeInTheDocument();
	});

	it("shows the not-found state for a missing instructor", async () => {
		getInstructorMock.mockRejectedValue(new Error("Not found"));
		renderRoute("/instructors/does-not-exist");

		expect(await screen.findByText("Instructor not found")).toBeInTheDocument();
	});

	it("shows the authored courses section with the instructor's name", async () => {
		getInstructorMock.mockResolvedValue(
			profile({
				courses: [
					{
						id: "c1",
						title: "React Basics",
						slug: "react-basics",
						description: null,
						level: "beginner",
						language: "en",
						thumbnailKey: null,
						thumbnailUrl: null,
						price: 5000,
						isFree: false,
						currency: "NGN",
						isEarnBackEligible: false,
						earnBackPercentage: null,
						_count: { modules: 4 },
					},
				],
			}),
		);
		renderRoute("/instructors/i1");

		expect(
			await screen.findByText("Courses by Ada Lovelace"),
		).toBeInTheDocument();
		expect(screen.getByText("React Basics")).toBeInTheDocument();
	});
});
