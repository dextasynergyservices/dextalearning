/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHART_COLORS } from "./chart-theme";

// Read as text, not imported: vitest's CSS pipeline swallows `?raw` and hands
// back an empty module, which made this spec pass vacuously. This spec runs in
// node (no jsdom pragma), so fs is available; the types reference scopes node
// typings to this file without widening the browser tsconfig.
const css = readFileSync(new URL("../../index.css", import.meta.url), "utf8");

/**
 * The palette exists in two places by necessity — this TS module (recharts
 * needs resolved values) and the `--chart-N` CSS tokens (Tailwind utilities).
 * They were dataviz-validated as ONE palette; if they drift, some marks pass
 * the checks and others silently don't. This spec is the mirror's lock.
 */
describe("chart palette (§15)", () => {
	it("mirrors the light palette into the :root --chart-N tokens", () => {
		CHART_COLORS.light.categorical.forEach((hex, i) => {
			expect(css).toMatch(new RegExp(`--chart-${i + 1}:\\s*${hex}`, "i"));
		});
	});

	it("mirrors the dark palette into the .dark --chart-N tokens", () => {
		CHART_COLORS.dark.categorical.forEach((hex) => {
			expect(css.toLowerCase()).toContain(hex.toLowerCase());
		});
	});

	it("keeps five categorical slots in both modes — never more to cycle into", () => {
		expect(CHART_COLORS.light.categorical).toHaveLength(5);
		expect(CHART_COLORS.dark.categorical).toHaveLength(5);
	});

	it("keeps the sequential ramps monotone in lightness direction", () => {
		// Cheap proxy that catches accidental reordering: hex → perceived luma.
		const luma = (hex: string) => {
			const n = Number.parseInt(hex.slice(1), 16);
			const r = (n >> 16) & 255;
			const g = (n >> 8) & 255;
			const b = n & 255;
			return 0.2126 * r + 0.7152 * g + 0.0722 * b;
		};
		const light = CHART_COLORS.light.sequential.map(luma);
		const dark = CHART_COLORS.dark.sequential.map(luma);
		// Light mode ramps light→dark; dark mode ramps dark→light.
		expect([...light].sort((a, b) => b - a)).toEqual(light);
		expect([...dark].sort((a, b) => a - b)).toEqual(dark);
	});
});
