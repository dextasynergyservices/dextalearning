/**
 * §13.2 budget gate: no JS chunk over 250KB gzipped. Run after `vite build`
 * (`bun run perf:budget`). Deliberately NOT wired into CI — run it before a
 * release or after adding a dependency; it exits non-zero on any breach so it
 * can gate a deploy script if one ever wants it.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_KB = 250;
const dir = new URL("../dist/assets", import.meta.url).pathname.replace(
	/^\/([A-Za-z]:)/,
	"$1",
);

let files;
try {
	files = readdirSync(dir).filter((f) => f.endsWith(".js"));
} catch {
	console.error("dist/assets not found — run `bunx vite build` first.");
	process.exit(2);
}

const rows = files
	.map((f) => {
		const raw = readFileSync(join(dir, f));
		return { file: f, gzipKB: Math.round(gzipSync(raw).length / 1024) };
	})
	.sort((a, b) => b.gzipKB - a.gzipKB);

const over = rows.filter((r) => r.gzipKB > BUDGET_KB);
for (const r of rows.slice(0, 10)) {
	const flag = r.gzipKB > BUDGET_KB ? "  ← OVER BUDGET" : "";
	console.log(`${String(r.gzipKB).padStart(5)} KB gz  ${r.file}${flag}`);
}
console.log(
	`\n${rows.length} chunks · budget ${BUDGET_KB}KB gz per chunk (§13.2)`,
);

if (over.length > 0) {
	console.error(`\nFAIL: ${over.length} chunk(s) over budget.`);
	process.exit(1);
}
console.log("PASS: every chunk within budget.");
