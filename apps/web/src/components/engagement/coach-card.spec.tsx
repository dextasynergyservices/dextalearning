// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { CoachCard } from "./coach-card";

const { getLatestCoachDigestMock } = vi.hoisted(() => ({
	getLatestCoachDigestMock: vi.fn(),
}));

vi.mock("@/lib/coach-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/coach-api")>();
	return { ...actual, getLatestCoachDigest: getLatestCoachDigestMock };
});

describe("CoachCard", () => {
	beforeEach(() => {
		getLatestCoachDigestMock.mockReset();
	});

	it("renders nothing until a digest exists", () => {
		getLatestCoachDigestMock.mockResolvedValue(null);
		const { container } = renderWithProviders(<CoachCard />);
		expect(container).toBeEmptyDOMElement();
	});

	it("shows the coaching headline, message and weekly focus", async () => {
		getLatestCoachDigestMock.mockResolvedValue({
			headline: "You're building real momentum!",
			message: "You finished 4 lessons this week.",
			action: "Explain spaced repetition in your own words.",
			weekOf: "2026-07-06",
			createdAt: new Date().toISOString(),
		});
		renderWithProviders(<CoachCard />);

		expect(
			await screen.findByText("You're building real momentum!"),
		).toBeInTheDocument();
		expect(
			screen.getByText("You finished 4 lessons this week."),
		).toBeInTheDocument();
		expect(screen.getByText("This week's focus")).toBeInTheDocument();
		expect(
			screen.getByText("Explain spaced repetition in your own words."),
		).toBeInTheDocument();
	});

	it("omits the focus block when there's no action", async () => {
		getLatestCoachDigestMock.mockResolvedValue({
			headline: "Nice week!",
			message: "Keep it up.",
			action: null,
			weekOf: "2026-07-06",
			createdAt: new Date().toISOString(),
		});
		renderWithProviders(<CoachCard />);

		await screen.findByText("Nice week!");
		expect(screen.queryByText("This week's focus")).not.toBeInTheDocument();
	});
});
