// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeachingCohort } from "@/lib/teaching-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, getMyTeachingCohortsMock } = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getMyTeachingCohortsMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/teaching-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/teaching-api")>();
	return { ...actual, getMyTeachingCohorts: getMyTeachingCohortsMock };
});

function cohort(overrides: Partial<TeachingCohort> = {}): TeachingCohort {
	return {
		id: "co1",
		title: "Frontend Cohort",
		slug: "frontend-cohort",
		status: "open",
		startsAt: null,
		learnerCount: 8,
		courseCount: 2,
		atRiskCount: 0,
		...overrides,
	};
}

describe("Instructor cohorts (teaching) page", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getMyTeachingCohortsMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada", role: "instructor" } },
			isPending: false,
		});
	});

	it("lists the cohorts the instructor teaches, with a read-only explainer", async () => {
		getMyTeachingCohortsMock.mockResolvedValue([cohort()]);
		renderRoute("/instructor/cohorts");

		expect(await screen.findByText("Frontend Cohort")).toBeInTheDocument();
		expect(screen.getByText("8 learners")).toBeInTheDocument();
		// The explainer defines what teaching a cohort means (read-only visibility).
		expect(screen.getByText(/read-only visibility/i)).toBeInTheDocument();
	});

	it("shows an empty state when nothing is assigned", async () => {
		getMyTeachingCohortsMock.mockResolvedValue([]);
		renderRoute("/instructor/cohorts");

		expect(
			await screen.findByText("No cohorts assigned yet"),
		).toBeInTheDocument();
	});
});
