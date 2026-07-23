// Applies the saved/system theme before first paint to avoid a flash of the
// wrong theme. Kept in sync at runtime by src/lib/theme.ts.
//
// This lives in its own file (rather than inline in index.html) so the app can
// ship a Content-Security-Policy without `script-src 'unsafe-inline'` — the
// directive that actually stops an injected `<img onerror=...>` from running.
// It is loaded as a render-blocking <script> in <head>, so it still runs before
// the first paint.
(() => {
	try {
		const t = localStorage.getItem("dexta-theme") || "system";
		const dark =
			t === "dark" ||
			(t === "system" &&
				window.matchMedia("(prefers-color-scheme: dark)").matches);
		if (dark) {
			document.documentElement.classList.add("dark");
			const m = document.querySelector('meta[name="theme-color"]');
			if (m) m.setAttribute("content", "#0a0a0a");
		}
	} catch (_e) {}
})();
