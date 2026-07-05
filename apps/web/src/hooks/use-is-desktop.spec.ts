// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsDesktop } from "./use-is-desktop";

function mockMatchMedia(initialMatches: boolean) {
	const listeners = new Set<(event: { matches: boolean }) => void>();
	let matches = initialMatches;
	const mql = {
		get matches() {
			return matches;
		},
		media: "(min-width: 1024px)",
		addEventListener: (
			_type: string,
			cb: (event: { matches: boolean }) => void,
		) => {
			listeners.add(cb);
		},
		removeEventListener: (
			_type: string,
			cb: (event: { matches: boolean }) => void,
		) => {
			listeners.delete(cb);
		},
	};
	window.matchMedia = vi
		.fn()
		.mockReturnValue(mql) as unknown as typeof window.matchMedia;
	return {
		change: (next: boolean) => {
			matches = next;
			for (const cb of listeners) cb({ matches: next });
		},
	};
}

const realMatchMedia = window.matchMedia;

afterEach(() => {
	window.matchMedia = realMatchMedia;
});

describe("useIsDesktop", () => {
	it("reflects the initial media query state", () => {
		mockMatchMedia(true);
		const { result } = renderHook(() => useIsDesktop());
		expect(result.current).toBe(true);
	});

	it("reacts to a change event (e.g. window resize crossing the breakpoint)", () => {
		const media = mockMatchMedia(false);
		const { result } = renderHook(() => useIsDesktop());
		expect(result.current).toBe(false);

		act(() => {
			media.change(true);
		});
		expect(result.current).toBe(true);
	});
});
