// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MyLearning, MyLearningItem } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, getMyLearningMock, getMyProfileMock } = vi.hoisted(
	() => ({
		useSessionMock: vi.fn(),
		getMyLearningMock: vi.fn(),
		getMyProfileMock: vi.fn(),
	}),
);

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getMyLearning: getMyLearningMock,
		getMyProfile: getMyProfileMock,
	};
});

function item(overrides: Partial<MyLearningItem> = {}): MyLearningItem {
	return {
		type: "course",
		id: "c1",
		title: "React Basics",
		slug: "react-basics",
		thumbnailUrl: null,
		isFree: false,
		isEarnBackEligible: false,
		earnBackPercentage: null,
		percent: 40,
		isComplete: false,
		...overrides,
	};
}

describe("MyLearningPage", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getMyLearningMock.mockReset();
		getMyProfileMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "learner" } },
			isPending: false,
		});
		getMyProfileMock.mockResolvedValue({ image: null });
	});

	it("shows the empty state with a browse-courses link when there's nothing yet", async () => {
		getMyLearningMock.mockResolvedValue({
			courses: [],
			paths: [],
			cohorts: [],
		} satisfies MyLearning);
		renderRoute("/learn/mine");

		expect(await screen.findByText("Nothing here yet")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /Browse courses/ }),
		).toHaveAttribute("href", "/teachers/courses");
	});

	it("shows the continue-learning hero for the first in-progress item", async () => {
		getMyLearningMock.mockResolvedValue({
			courses: [item()],
			paths: [],
			cohorts: [],
		} satisfies MyLearning);
		renderRoute("/learn/mine");

		expect(await screen.findByText("React Basics")).toBeInTheDocument();
		expect(screen.getByText("Pick up where you left off")).toBeInTheDocument();
		expect(screen.getByText("40%")).toBeInTheDocument();
	});

	it("splits items into in-progress and completed stat counts", async () => {
		getMyLearningMock.mockResolvedValue({
			courses: [
				item({ id: "c1", title: "React Basics", isComplete: false }),
				item({
					id: "c2",
					title: "Node Basics",
					isComplete: true,
					percent: 100,
				}),
			],
			paths: [],
			cohorts: [],
		} satisfies MyLearning);
		renderRoute("/learn/mine");

		await screen.findByText("React Basics");
		// "Completed" appears both as the stat chip label and the item's own badge.
		expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
		expect(screen.getByText("Node Basics")).toBeInTheDocument();
	});

	it("shows a 'More in progress' section when there's more than one in-progress item", async () => {
		getMyLearningMock.mockResolvedValue({
			courses: [
				item({ id: "c1", title: "React Basics" }),
				item({ id: "c2", title: "Vue Basics" }),
			],
			paths: [],
			cohorts: [],
		} satisfies MyLearning);
		renderRoute("/learn/mine");

		expect(await screen.findByText("More in progress")).toBeInTheDocument();
		expect(screen.getByText("Vue Basics")).toBeInTheDocument();
	});
});
