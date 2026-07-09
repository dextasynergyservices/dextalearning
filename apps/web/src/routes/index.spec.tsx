// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeaturedCatalog, PublishedCourse } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const {
	useSessionMock,
	getFeaturedMock,
	getRecommendedMock,
	getMyProfileMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getFeaturedMock: vi.fn(),
	getRecommendedMock: vi.fn(),
	getMyProfileMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getFeatured: getFeaturedMock,
		getRecommended: getRecommendedMock,
		getMyProfile: getMyProfileMock,
	};
});

function emptyCatalog(): FeaturedCatalog {
	return { courses: [], paths: [], cohorts: [] };
}

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
		enrolledCount: 0,
		_count: { modules: 4 },
		...overrides,
	};
}

describe("LandingPage", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getFeaturedMock.mockReset();
		getRecommendedMock.mockReset();
		useSessionMock.mockReturnValue({ data: null, isPending: false });
		getFeaturedMock.mockResolvedValue(emptyCatalog());
		getRecommendedMock.mockResolvedValue(emptyCatalog());
		getMyProfileMock.mockResolvedValue({ image: null });
	});

	it("renders the hero with real copy and a link to register", async () => {
		renderRoute("/");

		expect(
			await screen.findByText("Learning that", { exact: false }),
		).toBeInTheDocument();
		const ctas = screen.getAllByRole("link", {
			name: /Start learning free/,
		});
		expect(ctas.length).toBeGreaterThan(0);
		for (const cta of ctas) {
			expect(cta).toHaveAttribute("href", "/register");
		}
	});

	it("renders the featured courses shelf when there is featured content", async () => {
		getFeaturedMock.mockResolvedValue({
			courses: [course()],
			paths: [],
			cohorts: [],
		});
		renderRoute("/");

		expect(await screen.findByText("Featured courses")).toBeInTheDocument();
		expect(screen.getByText("React Basics")).toBeInTheDocument();
	});

	it("does not render the featured section when there is nothing featured", async () => {
		renderRoute("/");

		await screen.findByText("Learning that", { exact: false });
		expect(screen.queryByText("Featured courses")).not.toBeInTheDocument();
	});

	it("shows the personalized note on the recommended shelf for a signed-in learner", async () => {
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "learner" } },
			isPending: false,
		});
		getRecommendedMock.mockResolvedValue({
			courses: [course({ id: "c2", title: "Vue Basics" })],
			paths: [],
			cohorts: [],
			personalized: { courses: true, paths: false, cohorts: false },
		});
		renderRoute("/");

		expect(await screen.findByText("Recommended courses")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Because learners who enrolled in your courses also enrolled in these",
			),
		).toBeInTheDocument();
	});
});
