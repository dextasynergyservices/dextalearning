import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { observeOnEnter } from "@/lib/reveal-on-enter";

gsap.registerPlugin(useGSAP);

/**
 * Scroll-triggered reveal for a section. Any descendant marked with
 * `data-reveal` fades/slides in as it enters the viewport, staggered in DOM
 * order. Respects `prefers-reduced-motion` (WCAG 2.2 — blueprint §13.1):
 * when reduced motion is requested, no animation runs and content stays
 * visible.
 *
 * Visibility detection is IntersectionObserver, not GSAP ScrollTrigger — see
 * `lib/reveal-on-enter.ts` for why (ScrollTrigger's cached positions could
 * leave fold-adjacent sections stuck invisible after SPA navigation).
 *
 * Supports directional variants via `data-reveal` attribute value:
 * - `data-reveal` or `data-reveal=""` → fade + slide up (default)
 * - `data-reveal="left"` → fade + slide from left
 * - `data-reveal="right"` → fade + slide from right
 * - `data-reveal="scale"` → fade + scale up from 0.85
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
	const scope = useRef<T>(null);

	useGSAP(
		() => {
			if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
				return;
			}
			const el = scope.current;
			if (!el) return;

			const targets = gsap.utils.toArray<HTMLElement>("[data-reveal]", el);
			if (targets.length === 0) return;

			const hiddenState: Record<string, gsap.TweenVars> = {
				left: { opacity: 0, x: -48 },
				right: { opacity: 0, x: 48 },
				scale: { opacity: 0, scale: 0.85 },
				default: { opacity: 0, y: 32 },
			};
			for (const target of targets) {
				const dir = target.getAttribute("data-reveal") || "default";
				gsap.set(target, hiddenState[dir] ?? hiddenState.default);
			}

			// Mirrors the old ScrollTrigger `start: "top 82%"` line.
			const disconnect = observeOnEnter(
				targets,
				(target, batchIndex) => {
					gsap.to(target, {
						opacity: 1,
						x: 0,
						y: 0,
						scale: 1,
						duration: 0.7,
						ease: "power2.out",
						delay: batchIndex * 0.08,
						overwrite: "auto",
					});
				},
				"0px 0px -18% 0px",
			);
			return disconnect;
		},
		{ scope },
	);

	return scope;
}
