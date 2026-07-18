import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * WCAG 2.2 §1.4.3 contrast tripwire (Phase 8 · D6). The D7 axe audit found the
 * brand/status tokens failing AA on real surfaces; the fixes live in the CSS
 * custom properties below. This reads them straight from index.css and computes
 * the contrast ratios, so a future colour tweak that drops a token under 4.5:1
 * (or 3:1 for the large logo) fails here instead of silently shipping.
 *
 * Only the hex tokens are checked (the oklch neutrals are validated by the axe
 * crawler in scripts/a11y-audit.mjs, which is the source of truth for the full
 * sweep across every route × theme × language).
 */
const css = readFileSync(
	fileURLToPath(new URL("./index.css", import.meta.url)),
	"utf8",
);

/** Pull `--name: #hex;` from a given `:root`/`.dark` block. */
function token(block: "root" | "dark", name: string): string {
	const start = css.indexOf(block === "root" ? ":root {" : ".dark {");
	const slice = css.slice(start, css.indexOf("\n}", start));
	const m = slice.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
	if (!m) throw new Error(`token --${name} not found in ${block}`);
	return m[1];
}

function luminance(hex: string): number {
	const c = [1, 3, 5].map(
		(i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255,
	);
	const lin = c.map((v) =>
		v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
	);
	return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function ratio(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

const WHITE = "#ffffff";
const HERO = "#0a0a0a"; // --color-hero-bg, the darkest surface text sits on

describe("brand + status tokens meet WCAG AA", () => {
	it("solid button fill carries white text ≥ 4.5:1 (both themes)", () => {
		expect(ratio(token("root", "brand-solid"), WHITE)).toBeGreaterThanOrEqual(
			4.5,
		);
		expect(ratio(token("dark", "brand-solid"), WHITE)).toBeGreaterThanOrEqual(
			4.5,
		);
	});

	it("link/text blue ≥ 4.5:1 on the darkest surface (dark theme)", () => {
		expect(ratio(token("dark", "brand-primary"), HERO)).toBeGreaterThanOrEqual(
			4.5,
		);
	});

	it("light-mode brand text ≥ 4.5:1 on white", () => {
		expect(ratio(token("root", "brand-primary"), WHITE)).toBeGreaterThanOrEqual(
			4.5,
		);
	});

	it("error red ≥ 4.5:1 as text (white in light, near-black in dark)", () => {
		expect(ratio(token("root", "error"), WHITE)).toBeGreaterThanOrEqual(4.5);
		expect(ratio(token("dark", "error"), HERO)).toBeGreaterThanOrEqual(4.5);
	});
});
