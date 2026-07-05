// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReadingTranslation } from "./use-reading-translation";

const { translateTextsMock } = vi.hoisted(() => ({
	translateTextsMock: vi.fn(),
}));

vi.mock("@/lib/content-api", () => ({
	translateTexts: translateTextsMock,
}));

function wrapper({ children }: { children: ReactNode }) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}

describe("useReadingTranslation", () => {
	beforeEach(() => {
		translateTextsMock.mockReset();
	});

	it("returns the original text and does not fetch while lang is 'original'", () => {
		const { result } = renderHook(
			() => useReadingTranslation(["Hello", "World"]),
			{ wrapper },
		);
		expect(result.current.lang).toBe("original");
		expect(result.current.tr("Hello")).toBe("Hello");
		expect(translateTextsMock).not.toHaveBeenCalled();
	});

	it("fetches and maps translations once a language is selected", async () => {
		translateTextsMock.mockResolvedValue(["Bonjour", "Monde"]);
		const { result } = renderHook(
			() => useReadingTranslation(["Hello", "World"]),
			{ wrapper },
		);

		act(() => {
			result.current.setLang("fr");
		});

		await waitFor(() => {
			expect(result.current.tr("Hello")).toBe("Bonjour");
		});
		expect(result.current.tr("World")).toBe("Monde");
		expect(translateTextsMock).toHaveBeenCalledWith(["Hello", "World"], "fr");
	});

	it("deduplicates and drops blank strings before translating", async () => {
		translateTextsMock.mockResolvedValue(["Bonjour"]);
		const { result } = renderHook(
			() => useReadingTranslation(["Hello", "Hello", "  ", ""]),
			{ wrapper },
		);

		act(() => {
			result.current.setLang("fr");
		});

		await waitFor(() => {
			expect(translateTextsMock).toHaveBeenCalledWith(["Hello"], "fr");
		});
	});
});
