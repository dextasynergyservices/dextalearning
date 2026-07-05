// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	PublishedCohort,
	PublishedCourse,
	PublishedPath,
} from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const {
	getPublishedCoursesMock,
	getPublishedPathsMock,
	getPublishedCohortsMock,
} = vi.hoisted(() => ({
	getPublishedCoursesMock: vi.fn(),
	getPublishedPathsMock: vi.fn(),
	getPublishedCohortsMock: vi.fn(),
}));

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getPublishedCourses: getPublishedCoursesMock,
		getPublishedPaths: getPublishedPathsMock,
		getPublishedCohorts: getPublishedCohortsMock,
	};
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

function path(overrides: Partial<PublishedPath> = {}): PublishedPath {
	return {
		id: "p1",
		title: "Full Stack Path",
		slug: "full-stack",
		description: null,
		level: "beginner",
		outcomeStatement: null,
		estimatedHours: null,
		estimatedDuration: null,
		thumbnailUrl: null,
		price: 10000,
		isFree: false,
		currency: "NGN",
		isEarnBackEligible: false,
		earnBackPercentage: null,
		_count: { pathCourses: 3 },
		...overrides,
	};
}

function cohort(overrides: Partial<PublishedCohort> = {}): PublishedCohort {
	return {
		id: "co1",
		title: "January Cohort",
		slug: "january-cohort",
		description: null,
		startsAt: null,
		endsAt: null,
		capacity: null,
		seatsFilled: 0,
		price: 2000,
		isFree: false,
		currency: "NGN",
		isEarnBackEligible: false,
		earnBackPercentage: null,
		_count: { courses: 2 },
		...overrides,
	};
}

describe("SearchPage", () => {
	beforeEach(() => {
		getPublishedCoursesMock.mockReset();
		getPublishedPathsMock.mockReset();
		getPublishedCohortsMock.mockReset();
		getPublishedCoursesMock.mockResolvedValue([course()]);
		getPublishedPathsMock.mockResolvedValue([path()]);
		getPublishedCohortsMock.mockResolvedValue([cohort()]);
	});

	it("shows the start-search empty state before typing anything", async () => {
		renderRoute("/search");
		expect(await screen.findByText("Search DextaLearning")).toBeInTheDocument();
	});

	it("filters results across courses, paths and cohorts by title", async () => {
		const user = userEvent.setup();
		renderRoute("/search");
		const input = await screen.findByPlaceholderText(
			"Search courses, paths, cohorts",
		);

		await user.type(input, "react");

		expect(await screen.findByText("React Basics")).toBeInTheDocument();
		expect(screen.queryByText("Full Stack Path")).not.toBeInTheDocument();
		expect(screen.queryByText("January Cohort")).not.toBeInTheDocument();
	});

	it("shows the no-results empty state when nothing matches", async () => {
		const user = userEvent.setup();
		renderRoute("/search");
		const input = await screen.findByPlaceholderText(
			"Search courses, paths, cohorts",
		);

		await user.type(input, "nonexistent");

		expect(await screen.findByText("No results")).toBeInTheDocument();
	});

	it("restricts results to the selected type filter", async () => {
		const user = userEvent.setup();
		renderRoute("/search");
		const input = await screen.findByPlaceholderText(
			"Search courses, paths, cohorts",
		);
		// A query matching all three, but only the "Paths" chip selected.
		await user.type(input, "a");
		await user.click(screen.getByRole("button", { name: "Paths" }));

		expect(await screen.findByText("Full Stack Path")).toBeInTheDocument();
		expect(screen.queryByText("React Basics")).not.toBeInTheDocument();
		expect(screen.queryByText("January Cohort")).not.toBeInTheDocument();
	});

	it("pre-fills the query from the ?q= search param", async () => {
		renderRoute("/search?q=react");
		expect(await screen.findByText("React Basics")).toBeInTheDocument();
	});
});
