// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InstructorAnalytics } from "@/lib/analytics-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, getInstructorAnalyticsMock, getEntityLearnersMock } =
	vi.hoisted(() => ({
		useSessionMock: vi.fn(),
		getInstructorAnalyticsMock: vi.fn(),
		getEntityLearnersMock: vi.fn(),
	}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/analytics-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/analytics-api")>();
	return {
		...actual,
		getInstructorAnalytics: getInstructorAnalyticsMock,
		getEntityLearners: getEntityLearnersMock,
	};
});

function analytics(): InstructorAnalytics {
	return {
		totals: {
			items: 1,
			courses: 1,
			paths: 1,
			published: 1,
			enrollments: 30,
			completions: 12,
			inProgress: 10,
			notStarted: 8,
			completionRate: 40,
			learnersReached: 22,
		},
		courses: [
			{
				id: "c1",
				title: "React Basics",
				status: "published",
				live: true,
				enrolled: 30,
				completed: 12,
				inProgress: 10,
				notStarted: 8,
				completionRate: 40,
				avgProgressPct: 55,
				lastEnrolledAt: "2026-07-01T00:00:00Z",
			},
		],
		paths: [
			{
				id: "p1",
				title: "Frontend Path",
				status: "published",
				live: true,
				enrolled: 5,
				completed: 1,
				inProgress: 2,
				notStarted: 2,
				completionRate: 20,
				avgProgressPct: 30,
				lastEnrolledAt: "2026-07-02T00:00:00Z",
			},
		],
	};
}

describe("AnalyticsOverviewPage (instructor)", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getInstructorAnalyticsMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "instructor" } },
			isPending: false,
		});
		getInstructorAnalyticsMock.mockResolvedValue(analytics());
		getEntityLearnersMock.mockReset();
		getEntityLearnersMock.mockResolvedValue({
			entity: { id: "c1", title: "React Basics", type: "course" },
			learners: [],
		});
	});

	it("shows KPI tiles and the course list, and switches to the paths tab", async () => {
		const user = userEvent.setup();
		renderRoute("/instructor/analytics");

		// KPI tiles.
		expect(await screen.findByText("22")).toBeInTheDocument();
		expect(screen.getByText("Learners reached")).toBeInTheDocument();

		// Course tab (default) lists the course.
		expect(
			await screen.findByTestId("entity-analytics-list"),
		).toBeInTheDocument();
		expect(screen.getAllByText("React Basics").length).toBeGreaterThan(0);

		// Switch to Paths.
		await user.click(screen.getByRole("tab", { name: /Paths/ }));
		expect(screen.getAllByText("Frontend Path").length).toBeGreaterThan(0);
	});

	it("navigates to an entity's detail page on row click", async () => {
		const user = userEvent.setup();
		renderRoute("/instructor/analytics");

		await screen.findByTestId("entity-analytics-list");
		await user.click(
			screen.getAllByRole("button", { name: /React Basics/ })[0],
		);
		// The detail route mounts (its own query fires); the back-link is unique to it.
		expect(
			await screen.findByRole("link", { name: /Back to analytics/i }),
		).toBeInTheDocument();
	});
});
