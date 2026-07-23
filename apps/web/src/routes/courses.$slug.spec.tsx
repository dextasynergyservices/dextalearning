// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicCourse } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const {
	useSessionMock,
	getPublicCourseMock,
	getEnrollmentStatusMock,
	getCourseProgressMock,
	getCourseSocialProofMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getPublicCourseMock: vi.fn(),
	getEnrollmentStatusMock: vi.fn(),
	getCourseProgressMock: vi.fn(),
	getCourseSocialProofMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getPublicCourse: getPublicCourseMock,
		getEnrollmentStatus: getEnrollmentStatusMock,
		getCourseProgress: getCourseProgressMock,
	};
});

vi.mock("@/lib/engagement-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/engagement-api")>();
	return { ...actual, getCourseSocialProof: getCourseSocialProofMock };
});

function course(overrides: Partial<PublicCourse> = {}): PublicCourse {
	return {
		id: "c1",
		title: "React Basics",
		slug: "react-basics",
		academy: { slug: "teachers", name: "Teacher Academy" },
		description: "<p>Learn React from scratch.</p>",
		level: "beginner",
		language: "en",
		estimatedDuration: null,
		earnBackDeadlineDays: null,
		thumbnailUrl: null,
		price: 5000,
		isFree: false,
		currency: "NGN",
		isEarnBackEligible: false,
		earnBackPercentage: null,
		enrolledCount: 0,
		instructor: {
			id: "i1",
			name: "Ada Lovelace",
			image: null,
			headline: "Senior Engineer",
			bio: null,
			expertiseAreas: [],
		},
		modules: [
			{
				id: "m1",
				title: "Getting started",
				orderIndex: 0,
				lessons: [
					{
						id: "l1",
						title: "Intro",
						contentType: "video",
						orderIndex: 0,
						videoDurationSec: 300,
						audioDurationSec: null,
						isPreview: true,
					},
					{
						id: "l2",
						title: "Setup",
						contentType: "video",
						orderIndex: 1,
						videoDurationSec: 200,
						audioDurationSec: null,
						isPreview: false,
					},
				],
			},
		],
		...overrides,
	};
}

describe("CoursePage", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getPublicCourseMock.mockReset();
		getEnrollmentStatusMock.mockReset();
		getCourseProgressMock.mockReset();
		useSessionMock.mockReturnValue({ data: null, isPending: false });
		getEnrollmentStatusMock.mockResolvedValue({ enrolled: false });
		getCourseSocialProofMock.mockReset();
		getCourseSocialProofMock.mockResolvedValue({ completedThisWeek: 0 });
	});

	it("renders the course title, module outline and instructor", async () => {
		getPublicCourseMock.mockResolvedValue(course());
		renderRoute("/courses/react-basics");

		// "React Basics" also appears in a second (sr-only mobile) h1.
		const headings = await screen.findAllByRole("heading", {
			level: 1,
			name: "React Basics",
		});
		expect(headings.length).toBeGreaterThan(0);
		expect(screen.getByText("Getting started")).toBeInTheDocument();
		expect(screen.getByText("1. Intro")).toBeInTheDocument();
		expect(screen.getByText("2. Setup")).toBeInTheDocument();
		expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
	});

	it("shows social proof in the hero when the counters are positive (Phase 4, §3.2)", async () => {
		getPublicCourseMock.mockResolvedValue(course({ enrolledCount: 47 }));
		getCourseSocialProofMock.mockResolvedValue({ completedThisWeek: 5 });
		renderRoute("/courses/react-basics");

		expect(await screen.findByText("47 enrolled")).toBeInTheDocument();
		expect(
			await screen.findByText("5 completed this week"),
		).toBeInTheDocument();
	});

	it("shows the not-found state for a missing course", async () => {
		getPublicCourseMock.mockRejectedValue(new Error("Not found"));
		renderRoute("/courses/does-not-exist");

		expect(await screen.findByText("Course not found")).toBeInTheDocument();
	});

	it("shows the price and Earn-Back badge for a paid, Earn-Back eligible course", async () => {
		getPublicCourseMock.mockResolvedValue(
			course({ isEarnBackEligible: true, earnBackPercentage: 100 }),
		);
		renderRoute("/courses/react-basics");

		// The price renders in both the desktop sticky aside and the mobile bar.
		const prices = await screen.findAllByText("₦5,000");
		expect(prices.length).toBeGreaterThan(0);
	});

	it("shows a preview badge for the free-preview lesson", async () => {
		getPublicCourseMock.mockResolvedValue(course());
		renderRoute("/courses/react-basics");

		await screen.findByText("1. Intro");
		expect(screen.getAllByText("Preview").length).toBeGreaterThan(0);
	});
});
