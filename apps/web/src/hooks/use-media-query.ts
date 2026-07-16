import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query from JS.
 *
 * Use it only when the two branches must differ in *behaviour* — a dropdown vs
 * a bottom sheet own separate DOM and open-state, so CSS alone can't express
 * them. For purely visual differences prefer Tailwind's responsive classes: they
 * cost nothing and can't disagree with the stylesheet.
 */
export function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = useState(() =>
		typeof window === "undefined" ? false : window.matchMedia(query).matches,
	);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const list = window.matchMedia(query);
		// Re-read on mount: the query may have changed between render and effect.
		setMatches(list.matches);
		const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
		list.addEventListener("change", onChange);
		return () => list.removeEventListener("change", onChange);
	}, [query]);

	return matches;
}

/** Tailwind's `sm` breakpoint — the line this codebase splits mobile on. */
export const useIsMobile = () => !useMediaQuery("(min-width: 640px)");
