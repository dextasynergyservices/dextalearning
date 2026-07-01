import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import { scheduleScrollTriggerRefresh } from "@/lib/scroll-trigger-refresh";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Scroll-triggered reveal for a section. Any descendant marked with
 * `data-reveal` fades/slides in as the section enters the viewport, staggered
 * in DOM order. Respects `prefers-reduced-motion` (WCAG 2.2 — blueprint §13.1):
 * when reduced motion is requested, no animation runs and content stays visible.
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

			// Group targets by their reveal direction for proper animation
			const defaultTargets: HTMLElement[] = [];
			const leftTargets: HTMLElement[] = [];
			const rightTargets: HTMLElement[] = [];
			const scaleTargets: HTMLElement[] = [];

			for (const target of targets) {
				const dir = target.getAttribute("data-reveal");
				if (dir === "left") leftTargets.push(target);
				else if (dir === "right") rightTargets.push(target);
				else if (dir === "scale") scaleTargets.push(target);
				else defaultTargets.push(target);
			}

			const baseConfig = {
				opacity: 0,
				duration: 0.7,
				ease: "power2.out",
				stagger: 0.08,
			};

			const trigger = () => ({
				scrollTrigger: {
					trigger: el,
					start: "top 82%",
					// Fire at most once: a section near/at the fold can sit right on
					// the trigger boundary before layout has fully settled (fonts,
					// the view-transition cross-fade). scheduleScrollTriggerRefresh
					// below corrects the position once things settle, but WITHOUT
					// `once`, that later refresh can also flip an already-revealed
					// section back to hidden if it recalculates the boundary as
					// "not yet reached" — with no further scroll event left to ever
					// re-trigger it. `once` makes that flip impossible: the instant
					// it correctly fires, GSAP kills the trigger for good.
					once: true,
				},
			});

			if (defaultTargets.length > 0) {
				gsap.from(defaultTargets, {
					y: 32,
					...baseConfig,
					...trigger(),
				});
			}
			if (leftTargets.length > 0) {
				gsap.from(leftTargets, {
					x: -48,
					...baseConfig,
					...trigger(),
				});
			}
			if (rightTargets.length > 0) {
				gsap.from(rightTargets, {
					x: 48,
					...baseConfig,
					...trigger(),
				});
			}
			if (scaleTargets.length > 0) {
				gsap.from(scaleTargets, {
					scale: 0.85,
					...baseConfig,
					...trigger(),
				});
			}

			// Recompute trigger positions once this route's layout has truly
			// settled (client-side nav, the view-transition cross-fade, late
			// fonts) — see scheduleScrollTriggerRefresh for why this is needed.
			scheduleScrollTriggerRefresh();
		},
		{ scope },
	);

	return scope;
}
