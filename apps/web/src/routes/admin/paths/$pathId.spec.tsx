// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PathDetail } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, getPathMock } = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getPathMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return { ...actual, getPath: getPathMock };
});

function pathDetail(): PathDetail {
	return {
		id: "p1",
		title: "Full Stack Path",
		slug: "full-stack",
		academy: null,
		status: "draft",
		level: "beginner",
		thumbnailKey: null,
		thumbnailUrl: null,
		estimatedHours: null,
		createdAt: new Date().toISOString(),
		_count: { pathCourses: 0 },
		price: 10000,
		isFree: false,
		currency: "NGN",
		isEarnBackEligible: false,
		earnBackPercentage: null,
		description: null,
		outcomeStatement: null,
		estimatedDuration: null,
		earnBackDeadlineDays: null,
		isFeatured: false,
		featureRequested: false,
		introLesson: null,
		pathCourses: [],
		availableCourses: [],
	};
}

describe("AdminPathEditorRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getPathMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "admin" } },
			isPending: false,
		});
	});

	it("renders the admin studio chrome for the path editor", async () => {
		getPathMock.mockResolvedValue(pathDetail());
		renderRoute("/admin/paths/p1");

		expect((await screen.findAllByText("Admin Studio")).length).toBeGreaterThan(
			0,
		);
		expect(await screen.findByText("Courses in this path")).toBeInTheDocument();
	});
});
