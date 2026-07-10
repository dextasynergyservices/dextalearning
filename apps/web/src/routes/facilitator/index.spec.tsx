// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FacilitatedCohort } from "@/lib/facilitator-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, getMyFacilitatedCohortsMock } = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getMyFacilitatedCohortsMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/facilitator-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/facilitator-api")>();
	return { ...actual, getMyFacilitatedCohorts: getMyFacilitatedCohortsMock };
});

function cohort(overrides: Partial<FacilitatedCohort> = {}): FacilitatedCohort {
	return {
		id: "c1",
		title: "Frontend Bootcamp",
		slug: "frontend-bootcamp",
		status: "open",
		startsAt: null,
		groupingMode: "manual",
		learnerCount: 12,
		groupCount: 3,
		...overrides,
	};
}

describe("Facilitator portal home", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getMyFacilitatedCohortsMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada", role: "learner" } },
			isPending: false,
		});
	});

	it("lists the cohorts the user facilitates with learner and group counts", async () => {
		getMyFacilitatedCohortsMock.mockResolvedValue([cohort()]);
		renderRoute("/facilitator");

		expect(await screen.findByText("Frontend Bootcamp")).toBeInTheDocument();
		expect(screen.getByText("12 learners")).toBeInTheDocument();
		expect(screen.getByText("3 groups")).toBeInTheDocument();
	});

	it("shows an empty state when the user facilitates nothing", async () => {
		getMyFacilitatedCohortsMock.mockResolvedValue([]);
		renderRoute("/facilitator");

		expect(
			await screen.findByText("No cohorts to facilitate yet"),
		).toBeInTheDocument();
	});
});
