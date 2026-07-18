import { resolveTheme, useTheme } from "@/lib/theme";

/**
 * Chart color system (§15, dataviz-validated). CANONICAL SOURCE for the chart
 * palette — `--chart-1..5` in index.css mirror these values (a spec pins the
 * two in sync). Both palettes passed all five validator checks (lightness
 * band, chroma floor, CVD ΔE, normal-vision floor, contrast ≥3:1) against
 * their real surfaces: light on #ffffff, dark on the #171717 card. Dark is
 * SELECTED, not a flip: same hue order, re-stepped.
 *
 * Rules that keep charts honest (from the dataviz method):
 *  - Categorical slots are assigned in FIXED order 1→5, never cycled; a 6th
 *    series folds into "Other".
 *  - Series color follows the entity, never its rank — filters must not
 *    repaint survivors.
 *  - Status colors (success/warning/error) are reserved for state and never
 *    used as "series N".
 *  - Text never wears a series color: values/labels/legends stay in the ink
 *    tokens; the colored mark beside them carries identity.
 */
export const CHART_COLORS = {
	light: {
		categorical: ["#2563eb", "#0d9488", "#7c3aed", "#b45309", "#c026d3"],
		/** Sequential = brand blue, light→dark, monotone lightness. */
		sequential: ["#93c5fd", "#60a5fa", "#2563eb", "#1e40af"],
		grid: "#e5e7eb",
		axis: "#6b7280",
	},
	dark: {
		categorical: ["#3b82f6", "#0d9488", "#8b5cf6", "#d97706", "#d946ef"],
		sequential: ["#1e3a8a", "#1d4ed8", "#3b82f6", "#93c5fd"],
		grid: "#333333",
		axis: "#9ca3af",
	},
} as const;

export interface ChartColors {
	categorical: readonly string[];
	sequential: readonly string[];
	grid: string;
	axis: string;
}

/** The active palette; re-renders charts when the theme toggles. */
export function useChartColors(): ChartColors {
	const { theme } = useTheme();
	return CHART_COLORS[resolveTheme(theme)];
}
