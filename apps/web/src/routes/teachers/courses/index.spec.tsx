// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("CoursesCatalogPage", () => {
	beforeEach(() => {
		getPublishedCoursesMock.mockReset();
	});

	it("renders the published courses and a result count", async () => {
		getPublishedCoursesMock.mockResolvedValue([
			course({ id: "c1", title: "React Basics" }),
			course({ id: "c2", title: "Vue Basics" }),
		]);
		renderRoute("/teachers/courses");

		expect(await screen.findByText("React Basics")).toBeInTheDocument();
		expect(screen.getByText("Vue Basics")).toBeInTheDocument();
		expect(screen.getByText("2 courses")).toBeInTheDocument();
	});

	it("filters courses by the search field", async () => {
		getPublishedCoursesMock.mockResolvedValue([
			course({ id: "c1", title: "React Basics" }),
			course({ id: "c2", title: "Vue Basics" }),
		]);
		const user = userEvent.setup();
		renderRoute("/teachers/courses");
		await screen.findByText("React Basics");

		const input = screen.getByPlaceholderText("Search courses");
		await user.type(input, "react");

		expect(await screen.findByText("1 course")).toBeInTheDocument();
		expect(screen.queryByText("Vue Basics")).not.toBeInTheDocument();
	});

	it("shows the empty state with a clear-filters action when a search yields nothing", async () => {
		getPublishedCoursesMock.mockResolvedValue([course()]);
		const user = userEvent.setup();
		renderRoute("/teachers/courses");
		await screen.findByText("React Basics");

		await user.type(
			screen.getByPlaceholderText("Search courses"),
			"nonexistent",
		);

		expect(await screen.findByText("No courses found")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Clear filters" }),
		).toBeInTheDocument();
	});
});
