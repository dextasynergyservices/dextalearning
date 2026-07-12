// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { PacingNudge } from "./pacing-nudge";

const { getMyPacingMock } = vi.hoisted(() => ({ getMyPacingMock: vi.fn() }));

vi.mock("@/lib/pacing-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/pacing-api")>();
	return { ...actual, getMyPacing: getMyPacingMock };
});

describe("PacingNudge", () => {
	beforeEach(() => {
		getMyPacingMock.mockReset();
	});

	it("fetches nothing until enabled", () => {
		getMyPacingMock.mockResolvedValue({
			state: "ahead",
			lessonsThisWeek: 3,
			targetPerWeek: 3,
		});
		renderWithProviders(<PacingNudge enabled={false} />);
		expect(getMyPacingMock).not.toHaveBeenCalled();
	});

	it("shows the 'ahead' nudge with the week's numbers", async () => {
		getMyPacingMock.mockResolvedValue({
			state: "ahead",
			lessonsThisWeek: 5,
			targetPerWeek: 3,
		});
		renderWithProviders(<PacingNudge enabled />);
		await waitFor(() =>
			expect(
				screen.getByText(/ahead of your weekly goal — 5\/3 lessons/i),
			).toBeInTheDocument(),
		);
	});

	it("shows the 'rushing' nudge", async () => {
		getMyPacingMock.mockResolvedValue({
			state: "rushing",
			lessonsThisWeek: 8,
			targetPerWeek: 3,
		});
		renderWithProviders(<PacingNudge enabled />);
		await waitFor(() =>
			expect(screen.getByText(/moving fast/i)).toBeInTheDocument(),
		);
	});
});
