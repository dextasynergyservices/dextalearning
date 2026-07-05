// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicCohort } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, getPublicCohortMock, getEnrollmentStatusMock } =
	vi.hoisted(() => ({
		useSessionMock: vi.fn(),
		getPublicCohortMock: vi.fn(),
		getEnrollmentStatusMock: vi.fn(),
	}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getPublicCohort: getPublicCohortMock,
		getEnrollmentStatus: getEnrollmentStatusMock,
	};
});

function publicCohort(overrides: Partial<PublicCohort> = {}): PublicCohort {
	return {
		id: "co1",
		title: "January Cohort",
		slug: "january-cohort",
		description: "A guided cohort run.",
		startsAt: "2026-08-01T00:00:00.000Z",
		endsAt: null,
		capacity: 30,
		seatsFilled: 25,
		price: 2000,
		isFree: false,
		currency: "NGN",
		isEarnBackEligible: false,
		earnBackPercentage: null,
		introLesson: { id: "l1", contentType: null },
		_count: { courses: 1 },
		examMode: "unified",
		courses: [
			{
				orderIndex: 0,
				course: {
					id: "c1",
					title: "React Basics",
					slug: "react-basics",
					status: "published",
					level: "beginner",
					_count: { modules: 4 },
				},
			},
		],
		instructors: [{ user: { id: "i1", name: "Chinwe Okafor" } }],
		instructor: null,
		...overrides,
	} as PublicCohort;
}

describe("CohortDetailPage", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getPublicCohortMock.mockReset();
		getEnrollmentStatusMock.mockReset();
		useSessionMock.mockReturnValue({ data: null, isPending: false });
		getEnrollmentStatusMock.mockResolvedValue({ enrolled: false });
	});

	it("renders the cohort title, courses, seats and instructors", async () => {
		getPublicCohortMock.mockResolvedValue(publicCohort());
		renderRoute("/teachers/cohorts/january-cohort");

		const headings = await screen.findAllByRole("heading", {
			level: 1,
			name: "January Cohort",
		});
		expect(headings.length).toBeGreaterThan(0);
		expect(screen.getByText("React Basics")).toBeInTheDocument();
		expect(screen.getByText("Chinwe Okafor")).toBeInTheDocument();
		expect(screen.getAllByText("5 seats left").length).toBeGreaterThan(0);
	});

	it("shows the not-found state for a missing cohort", async () => {
		getPublicCohortMock.mockRejectedValue(new Error("Not found"));
		renderRoute("/teachers/cohorts/does-not-exist");

		expect(
			(await screen.findAllByText("Cohort not found")).length,
		).toBeGreaterThan(0);
	});

	it("shows the price and start date", async () => {
		getPublicCohortMock.mockResolvedValue(publicCohort());
		renderRoute("/teachers/cohorts/january-cohort");

		const prices = await screen.findAllByText("₦2,000");
		expect(prices.length).toBeGreaterThan(0);
	});
});
