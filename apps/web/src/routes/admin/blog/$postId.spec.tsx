// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlogPostDetail } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const {
	useSessionMock,
	getBlogPostMock,
	updateBlogPostMock,
	publishBlogPostMock,
	deleteBlogPostMock,
	uploadBlogCoverMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getBlogPostMock: vi.fn(),
	updateBlogPostMock: vi.fn(),
	publishBlogPostMock: vi.fn(),
	deleteBlogPostMock: vi.fn(),
	uploadBlogCoverMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getBlogPost: getBlogPostMock,
		updateBlogPost: updateBlogPostMock,
		publishBlogPost: publishBlogPostMock,
		deleteBlogPost: deleteBlogPostMock,
		uploadBlogCover: uploadBlogCoverMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function postDetail(overrides: Partial<BlogPostDetail> = {}): BlogPostDetail {
	return {
		id: "post1",
		title: "Why spacing beats cramming",
		slug: "why-spacing-beats-cramming",
		excerpt: null,
		category: "Learning science",
		status: "draft",
		authorName: "Ada Lovelace",
		readMinutes: 5,
		publishedAt: null,
		createdAt: new Date().toISOString(),
		coverKey: null,
		coverUrl: null,
		bodyHtml: "<p>Spacing effect content.</p>",
		...overrides,
	} as BlogPostDetail;
}

describe("BlogEditorPage", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getBlogPostMock.mockReset();
		updateBlogPostMock.mockReset();
		publishBlogPostMock.mockReset();
		deleteBlogPostMock.mockReset();
		uploadBlogCoverMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "admin" } },
			isPending: false,
		});
	});

	it("renders the post form prefilled with existing values", async () => {
		getBlogPostMock.mockResolvedValue(postDetail());
		renderRoute("/admin/blog/post1");

		expect(
			await screen.findByDisplayValue("Why spacing beats cramming"),
		).toBeInTheDocument();
		expect(screen.getByDisplayValue("Learning science")).toBeInTheDocument();
	});

	it("saves the post", async () => {
		const { toast } = await import("sonner");
		getBlogPostMock.mockResolvedValue(postDetail());
		updateBlogPostMock.mockResolvedValue(postDetail());
		const user = userEvent.setup();
		renderRoute("/admin/blog/post1");
		await screen.findByDisplayValue("Why spacing beats cramming");

		// Real locale key overrides the component's "Save"/"Saved" fallback text.
		await user.click(screen.getByRole("button", { name: "Save settings" }));

		await waitFor(() => {
			expect(updateBlogPostMock).toHaveBeenCalledWith(
				"post1",
				expect.objectContaining({ title: "Why spacing beats cramming" }),
			);
		});
		expect(toast.success).toHaveBeenCalledWith("Settings saved");
	});

	it("publishes the post", async () => {
		const { toast } = await import("sonner");
		getBlogPostMock.mockResolvedValue(postDetail());
		publishBlogPostMock.mockResolvedValue(postDetail({ status: "published" }));
		const user = userEvent.setup();
		renderRoute("/admin/blog/post1");
		await screen.findByDisplayValue("Why spacing beats cramming");

		await user.click(screen.getByRole("button", { name: "Publish post" }));

		await waitFor(() => {
			expect(publishBlogPostMock).toHaveBeenCalledWith("post1");
		});
		expect(toast.success).toHaveBeenCalledWith("Post published");
	});

	it("uploads a cover image", async () => {
		const { toast } = await import("sonner");
		getBlogPostMock.mockResolvedValue(postDetail());
		uploadBlogCoverMock.mockResolvedValue({
			coverKey: "k1",
			coverUrl: "https://cdn.example.com/k1.png",
		});
		const user = userEvent.setup();
		const { container } = renderRoute("/admin/blog/post1");
		await screen.findByDisplayValue("Why spacing beats cramming");

		const input = container.querySelector(
			'input[type="file"]',
		) as HTMLInputElement;
		const file = new File(["bytes"], "cover.png", { type: "image/png" });
		await user.upload(input, file);

		await waitFor(() => {
			expect(uploadBlogCoverMock).toHaveBeenCalledWith(
				"post1",
				expect.objectContaining({ name: "cover.png" }),
			);
		});
		expect(toast.success).toHaveBeenCalledWith("Cover updated");
	});

	it("deletes the post after confirming", async () => {
		const { toast } = await import("sonner");
		getBlogPostMock.mockResolvedValue(postDetail());
		deleteBlogPostMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/admin/blog/post1");
		await screen.findByDisplayValue("Why spacing beats cramming");

		await user.click(screen.getByRole("button", { name: "Delete" }));
		expect(await screen.findByText("Delete post?")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Delete course" }));

		await waitFor(() => {
			expect(deleteBlogPostMock).toHaveBeenCalledWith("post1");
		});
		expect(toast.success).toHaveBeenCalledWith("Post deleted");
	});
});
