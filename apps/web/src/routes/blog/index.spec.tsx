// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishedPost } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { getPublishedPostsMock } = vi.hoisted(() => ({
	getPublishedPostsMock: vi.fn(),
}));

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return { ...actual, getPublishedPosts: getPublishedPostsMock };
});

function post(overrides: Partial<PublishedPost> = {}): PublishedPost {
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
		...overrides,
	};
}

describe("BlogPage", () => {
	beforeEach(() => {
		getPublishedPostsMock.mockReset();
	});

	it("renders the post cards with category and excerpt", async () => {
		getPublishedPostsMock.mockResolvedValue([post()]);
		renderRoute("/blog");

		expect(
			await screen.findByText("Why spacing beats cramming"),
		).toBeInTheDocument();
		expect(
			screen.getByText("The science behind spaced repetition."),
		).toBeInTheDocument();
		expect(screen.getByText("5 min read")).toBeInTheDocument();
	});

	it("links each post card to its detail route", async () => {
		getPublishedPostsMock.mockResolvedValue([post()]);
		renderRoute("/blog");

		const link = await screen.findByRole("link", {
			name: /Why spacing beats cramming/,
		});
		expect(link).toHaveAttribute("href", "/blog/why-spacing-beats-cramming");
	});

	it("shows the empty state when there are no published articles", async () => {
		getPublishedPostsMock.mockResolvedValue([]);
		renderRoute("/blog");

		expect(
			await screen.findByText("No articles yet — check back soon."),
		).toBeInTheDocument();
	});
});
