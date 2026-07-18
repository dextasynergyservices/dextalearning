import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { scheduleScrollTriggerRefresh } from "@/lib/scroll-trigger-refresh";

/** The pieces the effect needs once the libraries have loaded. */
interface SmoothScrollHandle {
	scrollTo: (
		el: HTMLElement,
		opts: { offset: number; duration: number },
	) => void;
	destroy: () => void;
}

/**
 * App-wide momentum smooth scrolling (premium feel) via Lenis, kept in sync with
 * GSAP ScrollTrigger so the existing scroll reveals stay perfectly aligned. Also
 * glides to in-page `#anchor` targets (e.g. the More menu → Contact deep-link).
 *
 * - gsap + lenis load DYNAMICALLY (§13.2): this hook lives on the root route,
 *   which is in the entry chunk — a static import here shipped the whole
 *   animation stack to every user before first paint. The dynamic import moves
 *   it to its own chunk fetched after hydration; until it lands, native scroll
 *   works — which is also the exact behaviour reduced-motion users keep.
 * - Native on touch devices (Lenis `syncTouch` off by default) → mobile keeps
 *   its native scroll, per the mobile-first spec.
 * - Disabled entirely under `prefers-reduced-motion` (blueprint §13.1).
 */
export function useSmoothScroll() {
	const lenisRef = useRef<SmoothScrollHandle | null>(null);
	const { hash, pathname } = useLocation();

	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

		let cancelled = false;
		let cleanup: (() => void) | undefined;

		void (async () => {
			const [{ default: gsap }, { ScrollTrigger }, { default: Lenis }] =
				await Promise.all([
					import("gsap"),
					import("gsap/ScrollTrigger"),
					import("lenis"),
				]);
			if (cancelled) return;
			gsap.registerPlugin(ScrollTrigger);

			const lenis = new Lenis({
				lerp: 0.09,
				smoothWheel: true,
				wheelMultiplier: 1,
			});
			lenisRef.current = lenis;

			lenis.on("scroll", ScrollTrigger.update);

			const onRaf = (time: number) => lenis.raf(time * 1000);
			gsap.ticker.add(onRaf);
			gsap.ticker.lagSmoothing(0);

			cleanup = () => {
				gsap.ticker.remove(onRaf);
				lenis.destroy();
				lenisRef.current = null;
			};
		})();

		return () => {
			cancelled = true;
			cleanup?.();
		};
	}, []);

	// Defense-in-depth: each reveal primitive (useReveal/Reveal/
	// LearningScienceVisual) already schedules its own refresh right after
	// creating its triggers. This additional route-level pass catches anything
	// else on the page whose layout shifts after a client-side navigation.
	// biome-ignore lint/correctness/useExhaustiveDependencies: pathname is a re-run trigger on route change, not referenced in the body.
	useEffect(() => {
		scheduleScrollTriggerRefresh();
	}, [pathname]);

	// Smoothly scroll to a `#hash` target once the destination has rendered.
	useEffect(() => {
		if (!hash) return;
		const id = hash.replace(/^#/, "");
		let raf = 0;
		const tries = { n: 0 };
		const go = () => {
			const el = document.getElementById(id);
			if (el) {
				if (lenisRef.current) {
					lenisRef.current.scrollTo(el, { offset: -80, duration: 1.1 });
				} else {
					el.scrollIntoView({ behavior: "smooth" });
				}
				return;
			}
			if (tries.n++ < 20) raf = requestAnimationFrame(go);
		};
		raf = requestAnimationFrame(go);
		return () => cancelAnimationFrame(raf);
	}, [hash]);
}
