/**
 * Shared visual tokens for transactional emails (Resend + React Email,
 * blueprint §5.5 / §5.6). Mirrors the web brand: dark header, blue primary,
 * amber accent. Email-safe (inline styles, system-font stacks) — web fonts and
 * external CSS are unreliable across mail clients.
 */
export const colors = {
	bg: "#f8fafc",
	card: "#ffffff",
	ink: "#0f172a",
	body: "#334155",
	muted: "#64748b",
	faint: "#94a3b8",
	border: "#e2e8f0",
	primary: "#1d4ed8",
	accent: "#f59e0b",
	dark: "#0a0a0a",
} as const;

export const fontStack =
	"'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
export const monoStack =
	"'Space Grotesk', 'SFMono-Regular', Menlo, Consolas, monospace";

/**
 * Web-font files for the brand type, from the stable @fontsource CDN (same
 * families the app uses: Righteous / DM Sans / Space Grotesk). Embedded via the
 * `<Font>` component; clients without web-font support fall back to the stacks
 * above.
 */
const FONTSOURCE = "https://cdn.jsdelivr.net/fontsource/fonts";
export const FONTS = {
	dmSans400: `${FONTSOURCE}/dm-sans@latest/latin-400-normal.woff2`,
	dmSans600: `${FONTSOURCE}/dm-sans@latest/latin-600-normal.woff2`,
	righteous400: `${FONTSOURCE}/righteous@latest/latin-400-normal.woff2`,
	spaceGrotesk700: `${FONTSOURCE}/space-grotesk@latest/latin-700-normal.woff2`,
} as const;

/** Reusable paragraph styles so templates stay consistent and terse. */
export const text = {
	lead: {
		margin: "0 0 20px",
		color: colors.body,
		fontSize: "15px",
		lineHeight: "24px",
		fontFamily: fontStack,
	},
	hint: {
		margin: "0 0 4px",
		color: colors.muted,
		fontSize: "14px",
		fontFamily: fontStack,
	},
	fine: {
		margin: "20px 0 0",
		color: colors.faint,
		fontSize: "12px",
		lineHeight: "18px",
		fontFamily: fontStack,
	},
} as const;
