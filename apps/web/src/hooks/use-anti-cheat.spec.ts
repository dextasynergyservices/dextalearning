// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAntiCheat } from "./use-anti-cheat";

const { ingestAntiCheatMock } = vi.hoisted(() => ({
	ingestAntiCheatMock: vi.fn(),
}));

vi.mock("@/lib/content-api", () => ({
	ingestAntiCheat: ingestAntiCheatMock,
}));

function fireVisibilityHidden() {
	Object.defineProperty(document, "visibilityState", {
		value: "hidden",
		configurable: true,
	});
	document.dispatchEvent(new Event("visibilitychange"));
}

function baseOptions(
	overrides: Partial<Parameters<typeof useAntiCheat>[0]> = {},
) {
	return {
		attemptId: "a1",
		enabled: true,
		copyPasteBlocked: true,
		fullscreenRequired: false,
		tabSwitchLimit: 3,
		onAutoSubmit: vi.fn(),
		onTabSwitch: vi.fn(),
		...overrides,
	};
}

describe("useAntiCheat", () => {
	beforeEach(() => {
		ingestAntiCheatMock.mockReset();
		ingestAntiCheatMock.mockResolvedValue({
			accepted: 1,
			flagCount: 0,
			integrityScore: 100,
			autoSubmit: false,
			tabSwitches: 1,
			tabSwitchLimit: 3,
		});
	});

	it("reports each tab switch with an incrementing count", () => {
		const onTabSwitch = vi.fn();
		renderHook(() => useAntiCheat(baseOptions({ onTabSwitch })));

		act(() => {
			fireVisibilityHidden();
		});
		expect(onTabSwitch).toHaveBeenCalledWith(1, 3);

		act(() => {
			fireVisibilityHidden();
		});
		expect(onTabSwitch).toHaveBeenCalledWith(2, 3);
	});

	it("auto-submits locally once the tab-switch limit is reached", () => {
		const onAutoSubmit = vi.fn();
		renderHook(() =>
			useAntiCheat(baseOptions({ tabSwitchLimit: 2, onAutoSubmit })),
		);

		act(() => {
			fireVisibilityHidden();
		});
		expect(onAutoSubmit).not.toHaveBeenCalled();

		act(() => {
			fireVisibilityHidden();
		});
		expect(onAutoSubmit).toHaveBeenCalledOnce();
	});

	it("does not attach listeners when disabled", () => {
		const onTabSwitch = vi.fn();
		renderHook(() =>
			useAntiCheat(baseOptions({ enabled: false, onTabSwitch })),
		);

		act(() => {
			fireVisibilityHidden();
		});
		expect(onTabSwitch).not.toHaveBeenCalled();
	});

	it("blocks copy when copyPasteBlocked is true", () => {
		renderHook(() => useAntiCheat(baseOptions({ copyPasteBlocked: true })));
		const event = new Event("copy", { cancelable: true });
		document.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
	});

	it("allows copy when copyPasteBlocked is false", () => {
		renderHook(() => useAntiCheat(baseOptions({ copyPasteBlocked: false })));
		const event = new Event("copy", { cancelable: true });
		document.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
	});
});
