// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PathSummary } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, listMyPathsMock } = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	listMyPathsMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return { ...actual, listMyPaths: listMyPathsMock };
});

function path(overrides: Partial<PathSummary> = {}): PathSummary {
	return {
		id: "p1",
		title: "Full Stack Path",
		slug: "full-stack",
		status: "published",
		level: "beginner",
		thumbnailKey: null,
		thumbnailUrl: null,
		estimatedHours: null,
		createdAt: new Date().toISOString(),
		_count: { pathCourses: 3 },
		price: 10000,
		isFree: false,
		currency: "NGN",
		isEarnBackEligible: false,
		earnBackPercentage: null,
		...overrides,
	};
}

describe("AdminPathsRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		listMyPathsMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "admin" } },
			isPending: false,
		});
	});

	it("links paths into the admin editor route", async () => {
		listMyPathsMock.mockResolvedValue([path()]);
		renderRoute("/admin/paths");

		const link = await screen.findByRole("link", { name: /Full Stack Path/ });
		expect(link).toHaveAttribute("href", "/admin/paths/p1");
	});
});
