// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { SimplifyBlock } from "./simplify-block";

const { simplifyLessonMock } = vi.hoisted(() => ({
	simplifyLessonMock: vi.fn(),
}));

vi.mock("@/lib/simplifier-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/simplifier-api")>();
	return { ...actual, simplifyLesson: simplifyLessonMock };
});

describe("SimplifyBlock", () => {
	beforeEach(() => {
		simplifyLessonMock.mockReset();
	});

	it("fetches and shows the plain-language version on tap", async () => {
		simplifyLessonMock.mockResolvedValue({
			simplified: "Recursion is when a function calls itself.",
		});
		const user = userEvent.setup();
		renderWithProviders(<SimplifyBlock lessonId="l1" />);

		expect(
			screen.queryByText("Recursion is when a function calls itself."),
		).not.toBeInTheDocument();

		await user.click(screen.getByText("Simplify this lesson"));

		await waitFor(() =>
			expect(
				screen.getByText("Recursion is when a function calls itself."),
			).toBeInTheDocument(),
		);
		expect(simplifyLessonMock).toHaveBeenCalledWith("l1");
	});

	it("toggles the result without refetching", async () => {
		simplifyLessonMock.mockResolvedValue({ simplified: "Plain version." });
		const user = userEvent.setup();
		renderWithProviders(<SimplifyBlock lessonId="l1" />);

		await user.click(screen.getByText("Simplify this lesson"));
		await screen.findByText("Plain version.");

		// Collapse, then expand — the cached result reappears, no second fetch.
		await user.click(screen.getByText("Simplify this lesson"));
		await waitFor(() =>
			expect(screen.queryByText("Plain version.")).not.toBeInTheDocument(),
		);

		await user.click(screen.getByText("Simplify this lesson"));
		await screen.findByText("Plain version.");
		expect(simplifyLessonMock).toHaveBeenCalledTimes(1);
	});

	it("shows an error with a retry that refetches", async () => {
		simplifyLessonMock
			.mockRejectedValueOnce(new Error("boom"))
			.mockResolvedValueOnce({ simplified: "Recovered." });
		const user = userEvent.setup();
		renderWithProviders(<SimplifyBlock lessonId="l1" />);

		await user.click(screen.getByText("Simplify this lesson"));
		await screen.findByText("Couldn't simplify this. Please try again.");

		await user.click(screen.getByRole("button", { name: "Try again" }));
		await screen.findByText("Recovered.");
		expect(simplifyLessonMock).toHaveBeenCalledTimes(2);
	});
});
