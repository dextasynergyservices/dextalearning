// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { NextSessionPrompt } from "./next-session-prompt";

const { updateMyProfileMock } = vi.hoisted(() => ({
	updateMyProfileMock: vi.fn(),
}));

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return { ...actual, updateMyProfile: updateMyProfileMock };
});

describe("NextSessionPrompt", () => {
	beforeEach(() => {
		updateMyProfileMock.mockReset();
		updateMyProfileMock.mockResolvedValue({ ok: true });
	});

	it("asks the implementation-intention question with one-tap options (§3.2)", () => {
		renderWithProviders(<NextSessionPrompt />);
		expect(
			screen.getByText("When will you study next? Set it now."),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Tomorrow evening" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "This weekend" }),
		).toBeInTheDocument();
	});

	it("one tap saves the schedule and confirms in place", async () => {
		const user = userEvent.setup();
		renderWithProviders(<NextSessionPrompt />);

		await user.click(screen.getByRole("button", { name: "Tomorrow morning" }));

		expect(updateMyProfileMock.mock.calls[0][0]).toEqual({
			studySchedule: "morning",
		});
		expect(
			await screen.findByText("Locked in! We'll nudge you tomorrow morning."),
		).toBeInTheDocument();
		// The options are gone — the intention is set, no second decision.
		expect(
			screen.queryByRole("button", { name: "Tomorrow evening" }),
		).not.toBeInTheDocument();
	});
});
