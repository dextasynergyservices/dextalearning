// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PathSummary } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, listMyPathsMock, createPathMock, deletePathMock } =
	vi.hoisted(() => ({
		useSessionMock: vi.fn(),
		listMyPathsMock: vi.fn(),
		createPathMock: vi.fn(),
		deletePathMock: vi.fn(),
	}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		listMyPaths: listMyPathsMock,
		createPath: createPathMock,
		deletePath: deletePathMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

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

describe("InstructorPathsRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		listMyPathsMock.mockReset();
		createPathMock.mockReset();
		deletePathMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "instructor" } },
			isPending: false,
		});
	});

	it("renders the path list with price and course count", async () => {
		listMyPathsMock.mockResolvedValue([path()]);
		renderRoute("/instructor/paths");

		expect(await screen.findByText("Full Stack Path")).toBeInTheDocument();
		expect(screen.getByText("3 courses")).toBeInTheDocument();
		expect(screen.getByText("₦10,000")).toBeInTheDocument();
	});

	it("shows the empty state when there are no paths", async () => {
		listMyPathsMock.mockResolvedValue([]);
		renderRoute("/instructor/paths");

		expect(
			await screen.findByText("No paths yet — create your first journey."),
		).toBeInTheDocument();
	});

	it("creates a path from the inline form", async () => {
		listMyPathsMock.mockResolvedValue([]);
		createPathMock.mockResolvedValue(path({ id: "p2" }));
		const user = userEvent.setup();
		renderRoute("/instructor/paths");
		await screen.findByText("No paths yet — create your first journey.");

		await user.click(screen.getAllByRole("button", { name: "New path" })[0]);
		await user.type(screen.getByPlaceholderText("Path title"), "Backend Path");
		await user.click(screen.getByRole("button", { name: "Create path" }));

		await waitFor(() => {
			expect(createPathMock).toHaveBeenCalledWith({ title: "Backend Path" });
		});
	});

	it("deletes a path after confirming", async () => {
		const { toast } = await import("sonner");
		listMyPathsMock.mockResolvedValue([path()]);
		deletePathMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/instructor/paths");
		await screen.findByText("Full Stack Path");

		await user.click(screen.getByRole("button", { name: "Delete" }));
		expect(await screen.findByText("Delete path?")).toBeInTheDocument();
		// The confirm button reuses the courses namespace's "Delete course" label.
		await user.click(screen.getByRole("button", { name: "Delete course" }));

		await waitFor(() => {
			expect(deletePathMock).toHaveBeenCalledWith("p1");
		});
		expect(toast.success).toHaveBeenCalledWith("Path deleted");
	});
});
