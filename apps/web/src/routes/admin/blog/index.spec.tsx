// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlogPostSummary } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const {
	useSessionMock,
	listBlogPostsMock,
	createBlogPostMock,
	deleteBlogPostMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	listBlogPostsMock: vi.fn(),
	createBlogPostMock: vi.fn(),
	deleteBlogPostMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		listBlogPosts: listBlogPostsMock,
		createBlogPost: createBlogPostMock,
		deleteBlogPost: deleteBlogPostMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function post(overrides: Partial<BlogPostSummary> = {}): BlogPostSummary {
	return {
		id: "post1",
		title: "Why spacing beats cramming",
		slug: "why-spacing-beats-cramming",
		excerpt: null,
		category: "Learning science",
		status: "published",
		authorName: "Ada Lovelace",
		readMinutes: 5,
		publishedAt: new Date().toISOString(),
		createdAt: new Date().toISOString(),
		...overrides,
	} as BlogPostSummary;
}

describe("BlogListPage", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		listBlogPostsMock.mockReset();
		createBlogPostMock.mockReset();
		deleteBlogPostMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "admin" } },
			isPending: false,
		});
	});

	it("renders the post list with category and read time", async () => {
		listBlogPostsMock.mockResolvedValue([post()]);
		renderRoute("/admin/blog");

		expect(
			await screen.findByText("Why spacing beats cramming"),
		).toBeInTheDocument();
		expect(screen.getByText("Learning science")).toBeInTheDocument();
		expect(screen.getByText("5 min")).toBeInTheDocument();
	});

	it("shows the empty state when there are no posts", async () => {
		listBlogPostsMock.mockResolvedValue([]);
		renderRoute("/admin/blog");

		expect(
			await screen.findByText("No posts yet — write your first article."),
		).toBeInTheDocument();
	});

	it("creates a post from the inline form", async () => {
		listBlogPostsMock.mockResolvedValue([]);
		createBlogPostMock.mockResolvedValue(post({ id: "post2" }));
		const user = userEvent.setup();
		renderRoute("/admin/blog");
		await screen.findByText("No posts yet — write your first article.");

		await user.click(screen.getAllByRole("button", { name: "New post" })[0]);
		// Real locale key overrides the component's "Post title" fallback text.
		await user.type(screen.getByPlaceholderText("Title"), "A new article");
		await user.click(screen.getByRole("button", { name: "Create post" }));

		await waitFor(() => {
			expect(createBlogPostMock).toHaveBeenCalledWith({
				title: "A new article",
			});
		});
	});

	it("deletes a post after confirming", async () => {
		const { toast } = await import("sonner");
		listBlogPostsMock.mockResolvedValue([post()]);
		deleteBlogPostMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/admin/blog");
		await screen.findByText("Why spacing beats cramming");

		await user.click(screen.getByRole("button", { name: "Delete" }));
		expect(await screen.findByText("Delete post?")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Delete course" }));

		await waitFor(() => {
			expect(deleteBlogPostMock).toHaveBeenCalledWith("post1");
		});
		expect(toast.success).toHaveBeenCalledWith("Post deleted");
	});
});
