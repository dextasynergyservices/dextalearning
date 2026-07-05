// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishedCohort } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { getPublishedCohortsMock } = vi.hoisted(() => ({
	getPublishedCohortsMock: vi.fn(),
}));

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return { ...actual, getPublishedCohorts: getPublishedCohortsMock };
});

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

describe("CohortsCatalogPage", () => {
	beforeEach(() => {
		getPublishedCohortsMock.mockReset();
	});

	it("renders published cohorts and a result count", async () => {
		getPublishedCohortsMock.mockResolvedValue([
			cohort({ id: "co1", title: "January Cohort" }),
			cohort({ id: "co2", title: "March Cohort" }),
		]);
		renderRoute("/teachers/cohorts");

		expect(await screen.findByText("January Cohort")).toBeInTheDocument();
		expect(screen.getByText("March Cohort")).toBeInTheDocument();
		expect(screen.getByText("2 cohorts")).toBeInTheDocument();
	});

	it("filters cohorts by the search field", async () => {
		getPublishedCohortsMock.mockResolvedValue([
			cohort({ id: "co1", title: "January Cohort" }),
			cohort({ id: "co2", title: "March Cohort" }),
		]);
		const user = userEvent.setup();
		renderRoute("/teachers/cohorts");
		await screen.findByText("January Cohort");

		await user.type(screen.getByPlaceholderText("Search cohorts"), "march");

		expect(await screen.findByText("1 cohort")).toBeInTheDocument();
		expect(screen.queryByText("January Cohort")).not.toBeInTheDocument();
	});

	it("shows the empty state when there are no published cohorts", async () => {
		getPublishedCohortsMock.mockResolvedValue([]);
		renderRoute("/teachers/cohorts");

		expect(
			await screen.findByText("No cohorts yet — schedule your first run."),
		).toBeInTheDocument();
	});
});
