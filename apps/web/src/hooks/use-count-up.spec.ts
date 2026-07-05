// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCountUp } from "./use-count-up";

const realMatchMedia = window.matchMedia;

afterEach(() => {
	window.matchMedia = realMatchMedia;
});

describe("useCountUp", () => {
	it("starts at 0 (plus any suffix)", () => {
		const { result } = renderHook(() => useCountUp(94, { suffix: "%" }));
		expect(result.current.display).toBe("0%");
	});

	it("jumps straight to the final value under prefers-reduced-motion", () => {
		window.matchMedia = vi.fn().mockReturnValue({
			matches: true,
			addEventListener: () => {},
			removeEventListener: () => {},
		}) as unknown as typeof window.matchMedia;

		const { result } = renderHook(() => useCountUp(94, { suffix: "%" }));
		expect(result.current.display).toBe("94%");
	});
});
