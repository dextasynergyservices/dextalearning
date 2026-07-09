// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, getEntityLearnersMock, getLearnerDetailMock } =
	vi.hoisted(() => ({
		useSessionMock: vi.fn(),
		getEntityLearnersMock: vi.fn(),
		getLearnerDetailMock: vi.fn(),
	}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/analytics-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/analytics-api")>();
	return {
		...actual,
		getEntityLearners: getEntityLearnersMock,
		getLearnerDetail: getLearnerDetailMock,
	};
});

describe("EntityAnalyticsDetailPage (instructor)", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getEntityLearnersMock.mockReset();
		getLearnerDetailMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "instructor" } },
			isPending: false,
		});
		getEntityLearnersMock.mockResolvedValue({
			entity: { id: "c1", title: "React Basics", type: "course" },
			learners: [
				{
					userId: "L1",
					name: "Chinwe Okafor",
					enrolledAt: "2026-07-01T00:00:00Z",
					progressPercent: 60,
					isComplete: false,
					completedAt: null,
				},
			],
		});
	});

	it("shows the entity header, KPI tiles and the learner list", async () => {
		renderRoute("/instructor/analytics/course/c1");

		expect((await screen.findAllByText("React Basics")).length).toBeGreaterThan(
			0,
		);
		expect(
			await screen.findByTestId("learner-analytics-list"),
		).toBeInTheDocument();
		expect(screen.getAllByText("Chinwe Okafor").length).toBeGreaterThan(0);
		// Derived KPI tile: "1" enrolled learner.
		const tiles = screen.getByTestId("stat-tiles");
		expect(tiles).toHaveTextContent("Enrolled");
		expect(tiles).toHaveTextContent("1");
	});

	it("opens the per-student performance modal on a learner click", async () => {
		getLearnerDetailMock.mockResolvedValue({
			entity: { id: "c1", title: "React Basics", type: "course" },
			learner: {
				userId: "L1",
				name: "Chinwe Okafor",
				email: "c@example.com",
				progressPercent: 60,
				isComplete: false,
				completedAt: null,
			},
			lessons: [
				{ id: "l1", title: "Intro", completed: true, postQuizScore: 75 },
			],
			assessments: [],
		});
		const user = userEvent.setup();
		renderRoute("/instructor/analytics/course/c1");

		await screen.findByTestId("learner-analytics-list");
		await user.click(
			screen.getAllByRole("button", { name: /Chinwe Okafor/ })[0],
		);

		expect(await screen.findByText("Student performance")).toBeInTheDocument();
		expect(screen.getByText("Intro")).toBeInTheDocument();
		expect(getLearnerDetailMock).toHaveBeenCalledWith("course", "c1", "L1");
	});
});
