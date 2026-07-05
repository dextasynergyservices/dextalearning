// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishedCourse } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { getPublishedCoursesMock } = vi.hoisted(() => ({
	getPublishedCoursesMock: vi.fn(),
}));

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return { ...actual, getPublishedCourses: getPublishedCoursesMock };
});

function course(overrides: Partial<PublishedCourse> = {}): PublishedCourse {
	return {
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
		...overrides,
	};
}

describe("TeacherAcademyPage", () => {
	beforeEach(() => {
		getPublishedCoursesMock.mockReset();
	});

	it("renders the hero and the three growth pillars", async () => {
		getPublishedCoursesMock.mockResolvedValue([]);
		renderRoute("/teachers");

		expect(
			await screen.findByText("Grow into the teacher your students remember"),
		).toBeInTheDocument();
		// The footer also links to "Learning Paths" — check at least the pillar exists.
		expect(screen.getAllByText("Learning Paths").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Cohorts").length).toBeGreaterThan(0);
		expect(
			screen.getByRole("link", { name: /Browse courses/ }),
		).toHaveAttribute("href", "/teachers/courses");
	});

	it("shows the featured-empty state when there are no published courses", async () => {
		getPublishedCoursesMock.mockResolvedValue([]);
		renderRoute("/teachers");

		expect(
			await screen.findByText("New courses are on the way — check back soon."),
		).toBeInTheDocument();
	});

	it("renders up to the first 4 published courses as featured", async () => {
		getPublishedCoursesMock.mockResolvedValue([
			course({ id: "c1", title: "React Basics" }),
			course({ id: "c2", title: "Vue Basics" }),
		]);
		renderRoute("/teachers");

		expect(await screen.findByText("React Basics")).toBeInTheDocument();
		expect(screen.getByText("Vue Basics")).toBeInTheDocument();
	});
});
