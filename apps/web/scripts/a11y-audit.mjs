/**
 * D7 — WCAG 2.2 AA audit crawler. Drives the isolated audit preview (:4180,
 * built against the :4100 test API) with Playwright + axe-core, in all four
 * languages. Not a Playwright test file (the repo's playwright.config targets
 * the user's :5173 dev stack, which this must never touch). Run:
 *   node scripts/a11y-audit.mjs [--authed]
 */
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:4180";
const API = "http://localhost:4100";
const LANGS = ["en", "fr", "es", "pcm"];
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const PUBLIC_ROUTES = [
	["/", "landing"],
	["/login", "login"],
	["/register", "register"],
	["/forgot-password", "forgot-password"],
	["/reset-password?email=a@b.com", "reset-password"],
	["/2fa", "2fa"],
	["/verify-email?email=a@b.com", "verify-email"],
	["/pricing", "pricing"],
	["/catalog", "catalog"],
	["/leaderboard", "leaderboard"],
];

const AUTHED_ROUTES = [
	["/dashboard", "dashboard"],
	["/profile", "profile"],
	["/settings", "settings"],
];

const AUTH = { email: "audit@dexta.test", password: "AuditPass123!" };

const authed = process.argv.includes("--authed");
const ROUTES = authed ? [...PUBLIC_ROUTES, ...AUTHED_ROUTES] : PUBLIC_ROUTES;
const THEMES = ["light", "dark"];

/** Impact levels that fail the audit (WCAG AA-relevant). */
const FAIL_IMPACTS = new Set(["critical", "serious", "moderate"]);

const results = [];

const browser = await chromium.launch();
try {
	for (const lang of LANGS) {
		for (const theme of THEMES) {
			const context = await browser.newContext({
				colorScheme: theme === "dark" ? "dark" : "light",
			});
			// Seed language + theme before any app code runs.
			await context.addInitScript(
				({ l, th }) => {
					localStorage.setItem("i18nextLng", l);
					localStorage.setItem("dexta-theme", th);
				},
				{ l: lang, th: theme },
			);

			if (authed) {
				// Log in via the API, then inject the session cookie into the context.
				const res = await context.request.post(
					`${API}/api/auth/sign-in/email`,
					{
						data: AUTH,
					},
				);
				if (!res.ok()) console.error(`[${lang}] login failed: ${res.status()}`);
			}

			const page = await context.newPage();
			for (const [route, name] of ROUTES) {
				try {
					await page.goto(`${BASE}${route}`, {
						waitUntil: "networkidle",
						timeout: 20000,
					});
					await page.waitForTimeout(400); // settle animations/lazy content
					const landed = new URL(page.url()).pathname;
					const axe = await new AxeBuilder({ page })
						.withTags(WCAG_TAGS)
						.analyze();
					const violations = axe.violations.filter((v) =>
						FAIL_IMPACTS.has(v.impact ?? "minor"),
					);
					results.push({ lang, theme, name, route, landed, violations });
					const tag = violations.length ? `✗ ${violations.length}` : "✓";
					console.log(
						`[${lang}/${theme}] ${name.padEnd(16)} ${tag}${landed !== route.split("?")[0] ? ` (→ ${landed})` : ""}`,
					);
				} catch (err) {
					console.log(
						`[${lang}/${theme}] ${name.padEnd(16)} ERROR ${err.message}`,
					);
					results.push({ lang, theme, name, route, error: err.message });
				}
			}
			await context.close();
		}
	}
} finally {
	await browser.close();
}

// Aggregate unique violations by rule → where they occur.
const byRule = new Map();
for (const r of results) {
	for (const v of r.violations ?? []) {
		const entry = byRule.get(v.id) ?? {
			id: v.id,
			impact: v.impact,
			help: v.help,
			helpUrl: v.helpUrl,
			nodes: new Set(),
			where: new Set(),
		};
		entry.where.add(`${r.name}(${r.theme})`);
		for (const n of v.nodes) entry.nodes.add(n.target.join(" "));
		byRule.set(v.id, entry);
	}
}

console.log(
	`\n${"=".repeat(70)}\nWCAG 2.2 AA — unique violations by rule\n${"=".repeat(70)}`,
);
if (byRule.size === 0) {
	console.log("None. 🎉");
} else {
	for (const e of [...byRule.values()].sort((a, b) =>
		a.impact === b.impact ? 0 : a.impact === "critical" ? -1 : 1,
	)) {
		console.log(`\n● [${e.impact}] ${e.id} — ${e.help}`);
		console.log(`  pages: ${[...e.where].join(", ")}`);
		console.log(`  selectors (${e.nodes.size}):`);
		for (const n of [...e.nodes].slice(0, 8)) console.log(`    - ${n}`);
		if (e.nodes.size > 8) console.log(`    …+${e.nodes.size - 8} more`);
		console.log(`  ${e.helpUrl}`);
	}
}
console.log(
	`\nTotal: ${byRule.size} rule(s) across ${results.length} page-loads.`,
);
