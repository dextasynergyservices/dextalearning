// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/lib/i18n";
import { ErrorBoundaryFallback } from "./error-boundary-fallback";

/**
 * The screen a learner sees if the app itself crashes. It renders OUTSIDE the
 * router/query providers (they may be what crashed), so this spec renders it
 * bare — if it ever grows a dependency on those, this test fails first.
 */
describe("ErrorBoundaryFallback (§15)", () => {
	it("renders without router or query providers and offers recovery", async () => {
		const onRetry = vi.fn();
		render(<ErrorBoundaryFallback onRetry={onRetry} />);

		expect(screen.getByText("Something went wrong")).toBeInTheDocument();
		// The line that matters to a learner mid-lesson: nothing is lost.
		expect(screen.getByText(/nothing is lost/i)).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: /try again/i }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});
});
