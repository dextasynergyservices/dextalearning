// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearLocalAnswers,
	loadLocalAnswers,
	useAttemptResilience,
} from "./use-attempt-resilience";

const { saveMock } = vi.hoisted(() => ({ saveMock: vi.fn() }));

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return { ...actual, saveAttemptAnswer: saveMock };
});

describe("useAttemptResilience (§4.6.3-compatible offline resilience)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
	});

	it("mirrors answers locally the moment they are chosen", () => {
		saveMock.mockResolvedValue({});
		const { result } = renderHook(() => useAttemptResilience("a1"));

		act(() => {
			result.current.persistAnswer({ q1: "B" }, "q1", "B");
		});

		// The mirror is what a crash/refresh mid-outage restores from.
		expect(loadLocalAnswers("a1")).toEqual({ q1: "B" });
	});

	it("queues a failed save and flushes it when connectivity returns", async () => {
		saveMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		const { result } = renderHook(() => useAttemptResilience("a1"));

		act(() => {
			result.current.persistAnswer({ q1: "B" }, "q1", "B");
		});
		await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));

		// Back online: the queued save goes through.
		saveMock.mockResolvedValue({});
		act(() => {
			window.dispatchEvent(new Event("online"));
		});
		await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(2));
		expect(saveMock).toHaveBeenLastCalledWith("a1", "q1", "B");
	});

	it("flushes the LATEST answer when one changed while offline", async () => {
		saveMock.mockRejectedValue(new TypeError("Failed to fetch"));
		const { result } = renderHook(() => useAttemptResilience("a1"));

		act(() => {
			result.current.persistAnswer({ q1: "B" }, "q1", "B");
		});
		await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
		act(() => {
			result.current.persistAnswer({ q1: "C" }, "q1", "C");
		});
		await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(2));

		saveMock.mockClear();
		saveMock.mockResolvedValue({});
		act(() => {
			window.dispatchEvent(new Event("online"));
		});
		// Last write wins — the server never receives the stale "B".
		await waitFor(() => expect(saveMock).toHaveBeenCalledWith("a1", "q1", "C"));
		expect(saveMock).not.toHaveBeenCalledWith("a1", "q1", "B");
	});

	it("clears the mirror on demand (successful submit)", () => {
		saveMock.mockResolvedValue({});
		const { result } = renderHook(() => useAttemptResilience("a1"));
		act(() => {
			result.current.persistAnswer({ q1: "B" }, "q1", "B");
		});
		clearLocalAnswers("a1");
		expect(loadLocalAnswers("a1")).toEqual({});
	});

	it("keeps attempts isolated — one attempt's mirror never leaks into another", () => {
		saveMock.mockResolvedValue({});
		const a = renderHook(() => useAttemptResilience("a1"));
		act(() => {
			a.result.current.persistAnswer({ q1: "B" }, "q1", "B");
		});
		expect(loadLocalAnswers("a2")).toEqual({});
	});
});
