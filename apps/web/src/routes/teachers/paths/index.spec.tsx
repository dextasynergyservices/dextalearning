// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishedPath } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { getPublishedPathsMock } = vi.hoisted(() => ({
	getPublishedPathsMock: vi.fn(),
}));

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return { ...actual, getPublishedPaths: getPublishedPathsMock };
});

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

describe("PathsCatalogPage", () => {
	beforeEach(() => {
		getPublishedPathsMock.mockReset();
	});

	it("renders published paths and a result count", async () => {
		getPublishedPathsMock.mockResolvedValue([
			path({ id: "p1", title: "Full Stack Path", level: "beginner" }),
			path({ id: "p2", title: "Advanced Path", level: "advanced" }),
		]);
		renderRoute("/teachers/paths");

		expect(await screen.findByText("Full Stack Path")).toBeInTheDocument();
		expect(screen.getByText("Advanced Path")).toBeInTheDocument();
		expect(screen.getByText("2 paths")).toBeInTheDocument();
	});

	it("filters by level", async () => {
		getPublishedPathsMock.mockResolvedValue([
			path({ id: "p1", title: "Full Stack Path", level: "beginner" }),
			path({ id: "p2", title: "Advanced Path", level: "advanced" }),
		]);
		const user = userEvent.setup();
		renderRoute("/teachers/paths");
		await screen.findByText("Full Stack Path");

		await user.click(screen.getByRole("button", { name: "Advanced" }));

		expect(await screen.findByText("1 path")).toBeInTheDocument();
		expect(screen.queryByText("Full Stack Path")).not.toBeInTheDocument();
	});

	it("shows the empty state with a clear-filters action when filters yield nothing", async () => {
		getPublishedPathsMock.mockResolvedValue([
			path({ id: "p1", title: "Full Stack Path", level: "beginner" }),
		]);
		const user = userEvent.setup();
		renderRoute("/teachers/paths");
		await screen.findByText("Full Stack Path");

		await user.click(screen.getByRole("button", { name: "Advanced" }));

		expect(await screen.findByText("No courses found")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Clear filters" }),
		).toBeInTheDocument();
	});
});
