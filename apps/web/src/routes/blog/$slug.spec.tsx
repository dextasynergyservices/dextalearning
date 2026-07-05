// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicPost } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { getPublicPostMock } = vi.hoisted(() => ({
	getPublicPostMock: vi.fn(),
}));

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return { ...actual, getPublicPost: getPublicPostMock };
});

function post(overrides: Partial<PublicPost> = {}): PublicPost {
	return {
		id: "post1",
		title: "Why spacing beats cramming",
		slug: "why-spacing-beats-cramming",
		excerpt: "The science behind spaced repetition.",
		category: "Learning science",
		authorName: "Ada Lovelace",
		readMinutes: 5,
		publishedAt: "2026-06-01T00:00:00.000Z",
		coverUrl: null,
		bodyHtml: "<p>Spacing effect content.</p>",
		...overrides,
	};
}

describe("BlogPostPage", () => {
	beforeEach(() => {
		getPublicPostMock.mockReset();
	});

	it("renders the article title, byline and body", async () => {
		getPublicPostMock.mockResolvedValue(post());
		renderRoute("/blog/why-spacing-beats-cramming");

		// PublicShell also renders the title as a sr-only mobile heading.
		expect(
			(await screen.findAllByText("Why spacing beats cramming")).length,
		).toBeGreaterThan(0);
		expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0);
		expect(screen.getByText("Spacing effect content.")).toBeInTheDocument();
		expect(screen.getByText("5 min read")).toBeInTheDocument();
	});

	it("shows the not-found state for a missing article", async () => {
		getPublicPostMock.mockRejectedValue(new Error("Not found"));
		renderRoute("/blog/does-not-exist");

		expect(await screen.findByText("Article not found")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "All articles" })).toHaveAttribute(
			"href",
			"/blog",
		);
	});

	it("shows the CTA linking to the course catalog", async () => {
		getPublicPostMock.mockResolvedValue(post());
		renderRoute("/blog/why-spacing-beats-cramming");

		await screen.findAllByText("Why spacing beats cramming");
		expect(
			screen.getByRole("link", { name: /Browse courses/ }),
		).toHaveAttribute("href", "/teachers/courses");
	});
});
