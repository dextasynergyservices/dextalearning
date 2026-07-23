import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/locales/en/engagement.json";

/**
 * Every notification the API can emit must have BOTH display copy and a route.
 * Miss either and the bell silently falls back to `default` — which reads
 * "Update" with an empty body and links to the learner dashboard, so an admin
 * gets a blank notice that takes them to the wrong app. That shipped once; this
 * makes it impossible to ship again without the test going red.
 *
 * Deliberately source-scanning rather than hand-maintained: a new `notify()`
 * call is caught the moment it's added, which is exactly when a hand-written
 * list would have been forgotten.
 */
const API_SRC = join(process.cwd(), "..", "api", "src");
const BELL = join(
	process.cwd(),
	"src",
	"components",
	"layout",
	"notification-bell.tsx",
);

/** Types passed to `notifications.notify(...)`, including ternary branches. */
function emittedTypes(): string[] {
	const { execSync } =
		require("node:child_process") as typeof import("node:child_process");
	// Grep the API source for notify() calls and pull every quoted type off the
	// following lines (covers `type: "x"` and `type: cond ? "x" : "y"`).
	//
	// Case-INSENSITIVE on purpose: services wrap the call in helpers like
	// `safeNotify(...)` / `notifyAdminsOf...(...)`, and a case-sensitive
	// `notify(` silently missed those — which let two types slip past this very
	// guard. Matching loosely costs nothing: extra matches just contribute no
	// `type:` lines.
	const out = execSync(
		`grep -rni "notify(" -A 3 "${API_SRC}" --include=*.ts || true`,
		{ encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
	);
	const types = new Set<string>();
	for (const line of out.split("\n")) {
		if (line.includes(".spec.")) continue;
		const match = line.match(/type:\s*(.+)$/);
		if (!match) continue;
		for (const quoted of match[1].matchAll(/"([a-z_]+)"/g))
			types.add(quoted[1]);
	}
	return [...types];
}

describe("notification coverage", () => {
	const emitted = emittedTypes();
	const bell = readFileSync(BELL, "utf8");
	const copy = (en as { notifications: { types: Record<string, unknown> } })
		.notifications.types;

	it("finds the notification types the API emits", () => {
		// A guard on the guard: if the scan breaks, the assertions below would
		// vacuously pass.
		expect(emitted.length).toBeGreaterThan(10);
		expect(emitted).toContain("badge_awarded");
	});

	it("gives every emitted type display copy (never the blank 'Update')", () => {
		const missing = emitted.filter((type) => !(type in copy));
		expect(
			missing,
			`no notifications.types.* copy for: ${missing.join(", ")}`,
		).toEqual([]);
	});

	it("gives every emitted type its own route (never the learner dashboard by default)", () => {
		const missing = emitted.filter(
			(type) => !new RegExp(`\\n\\t${type}:\\s*\\{`).test(bell),
		);
		expect(missing, `no TYPE_META entry for: ${missing.join(", ")}`).toEqual(
			[],
		);
	});
});
