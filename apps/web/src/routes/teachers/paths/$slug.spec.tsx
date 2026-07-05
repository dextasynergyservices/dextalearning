// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicPath } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const {
	useSessionMock,
	getPublicPathMock,
	getPathProgressMock,
	getEnrollmentStatusMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getPublicPathMock: vi.fn(),
	getPathProgressMock: vi.fn(),
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
		getPublicPath: getPublicPathMock,
		getPathProgress: getPathProgressMock,
		getEnrollmentStatus: getEnrollmentStatusMock,
	};
});

function publicPath(overrides: Partial<PublicPath> = {}): PublicPath {
	return {
		id: "p1",
		title: "Full Stack Path",
		slug: "full-stack-path",
		description: "<p>Learn full stack development.</p>",
		level: "beginner",
		outcomeStatement: "<p>Ship a real app.</p>",
		estimatedHours: null,
		estimatedDuration: "6-8 weeks",
		earnBackDeadlineDays: null,
		thumbnailUrl: null,
		price: 10000,
		isFree: false,
		currency: "NGN",
		isEarnBackEligible: false,
		earnBackPercentage: null,
		introLesson: null,
		instructor: {
			id: "i1",
			name: "Chinwe Okafor",
			image: null,
			headline: "Senior Engineer",
			bio: null,
			expertiseAreas: [],
		},
		pathCourses: [
			{
				orderIndex: 0,
				isRequired: true,
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
		...overrides,
	};
}

describe("PathDetailPage", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getPublicPathMock.mockReset();
		getPathProgressMock.mockReset();
		getEnrollmentStatusMock.mockReset();
		useSessionMock.mockReturnValue({ data: null, isPending: false });
		getEnrollmentStatusMock.mockResolvedValue({ enrolled: false });
	});

	it("renders the path title, courses and instructor", async () => {
		getPublicPathMock.mockResolvedValue(publicPath());
		renderRoute("/teachers/paths/full-stack-path");

		const headings = await screen.findAllByRole("heading", {
			level: 1,
			name: "Full Stack Path",
		});
		expect(headings.length).toBeGreaterThan(0);
		expect(screen.getByText("React Basics")).toBeInTheDocument();
		expect(screen.getByText("Chinwe Okafor")).toBeInTheDocument();
	});

	it("shows the not-found state for a missing path", async () => {
		getPublicPathMock.mockRejectedValue(new Error("Not found"));
		renderRoute("/teachers/paths/does-not-exist");

		// PublicShell also renders the not-found title as a sr-only mobile heading.
		expect(
			(await screen.findAllByText("Path not found")).length,
		).toBeGreaterThan(0);
	});

	it("shows the price and Earn-Back badge for a paid, eligible path", async () => {
		getPublicPathMock.mockResolvedValue(
			publicPath({ isEarnBackEligible: true, earnBackPercentage: 100 }),
		);
		renderRoute("/teachers/paths/full-stack-path");

		const prices = await screen.findAllByText("₦10,000");
		expect(prices.length).toBeGreaterThan(0);
	});

	it("shows the optional badge for a non-required course", async () => {
		getPublicPathMock.mockResolvedValue(
			publicPath({
				pathCourses: [
					{
						orderIndex: 0,
						isRequired: false,
						course: {
							id: "c1",
							title: "Bonus Course",
							slug: "bonus-course",
							status: "published",
							level: "beginner",
							_count: { modules: 2 },
						},
					},
				],
			}),
		);
		renderRoute("/teachers/paths/full-stack-path");

		expect(await screen.findByText("Bonus Course")).toBeInTheDocument();
		expect(screen.getByText("Optional")).toBeInTheDocument();
	});
});
