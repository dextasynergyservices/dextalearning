// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseSummary } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, listMyCoursesMock } = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	listMyCoursesMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return { ...actual, listMyCourses: listMyCoursesMock };
});

function course(overrides: Partial<CourseSummary> = {}): CourseSummary {
	return {
		id: "c1",
		title: "React Basics",
		slug: "react-basics",
		status: "published",
		level: "beginner",
		thumbnailKey: null,
		thumbnailUrl: null,
		createdAt: new Date().toISOString(),
		_count: { modules: 4 },
		price: 5000,
		isFree: false,
		currency: "NGN",
		isEarnBackEligible: false,
		earnBackPercentage: null,
		...overrides,
	};
}

describe("AdminCoursesRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		listMyCoursesMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "admin" } },
			isPending: false,
		});
	});

	it("renders the admin-specific heading and links courses into the admin editor", async () => {
		listMyCoursesMock.mockResolvedValue([course()]);
		renderRoute("/admin/courses");

		expect(
			await screen.findByText("Manage every course on the platform"),
		).toBeInTheDocument();
		const link = await screen.findByRole("link", { name: /React Basics/ });
		expect(link).toHaveAttribute("href", "/admin/courses/c1");
	});

	it("shows the admin-specific empty state text", async () => {
		listMyCoursesMock.mockResolvedValue([]);
		renderRoute("/admin/courses");

		expect(
			await screen.findByText("No platform courses have been created yet."),
		).toBeInTheDocument();
	});
});
