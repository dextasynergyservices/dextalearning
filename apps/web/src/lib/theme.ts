import { useSyncExternalStore } from "react";

/**
 * App theme. `system` follows the OS preference; `light`/`dark` pin it. The
 * initial class is applied pre-paint by the inline script in index.html; this
 * module keeps it in sync at runtime and exposes a small store via {@link useTheme}.
 */
export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "dexta-theme";
const DARK_THEME_COLOR = "#0a0a0a";
const LIGHT_THEME_COLOR = "#ffffff";

function systemPrefersDark(): boolean {
	return (
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-color-scheme: dark)").matches
	);
}

export function getStoredTheme(): Theme {
	if (typeof localStorage === "undefined") return "system";
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored === "light" || stored === "dark" || stored === "system"
		? stored
		: "system";
}

/** The concrete light/dark a `Theme` resolves to right now. */
export function resolveTheme(theme: Theme): "light" | "dark" {
	if (theme === "system") return systemPrefersDark() ? "dark" : "light";
	return theme;
}

/** Toggle the `.dark` class + the address-bar colour to match `theme`. */
export function applyTheme(theme: Theme): void {
	if (typeof document === "undefined") return;
	const isDark = resolveTheme(theme) === "dark";
	document.documentElement.classList.toggle("dark", isDark);
	document
		.querySelector('meta[name="theme-color"]')
		?.setAttribute("content", isDark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
}

let current: Theme = getStoredTheme();
const listeners = new Set<() => void>();

export function setTheme(theme: Theme): void {
	current = theme;
	try {
		localStorage.setItem(STORAGE_KEY, theme);
	} catch {
		// private mode / storage disabled — runtime toggle still works for the session.
	}
	applyTheme(theme);
	for (const l of listeners) l();
}

function subscribe(onChange: () => void): () => void {
	listeners.add(onChange);
	// While in `system` mode, react to OS theme changes live.
	const mq = window.matchMedia("(prefers-color-scheme: dark)");
	const onSystemChange = () => {
		if (current === "system") {
			applyTheme("system");
			onChange();
		}
	};
	mq.addEventListener("change", onSystemChange);
	return () => {
		listeners.delete(onChange);
		mq.removeEventListener("change", onSystemChange);
	};
}

/** `{ theme, isDark, setTheme }` — subscribe a component to the theme store. */
export function useTheme() {
	const theme = useSyncExternalStore(
		subscribe,
		() => current,
		() => "system" as Theme,
	);
	return { theme, isDark: resolveTheme(theme) === "dark", setTheme };
}
