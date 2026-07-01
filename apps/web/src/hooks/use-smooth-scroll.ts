import { useLocation } from "@tanstack/react-router";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect, useRef } from "react";
import { scheduleScrollTriggerRefresh } from "@/lib/scroll-trigger-refresh";

gsap.registerPlugin(ScrollTrigger);

/**
 * App-wide momentum smooth scrolling (premium feel) via Lenis, kept in sync with
 * GSAP ScrollTrigger so the existing scroll reveals stay perfectly aligned. Also
 * glides to in-page `#anchor` targets (e.g. the More menu → Contact deep-link).
 *
 * - Native on touch devices (Lenis `syncTouch` off by default) → mobile keeps
 *   its native scroll, per the mobile-first spec.
 * - Disabled entirely under `prefers-reduced-motion` (blueprint §13.1).
 */
export function useSmoothScroll() {
	const lenisRef = useRef<Lenis | null>(null);
	const { hash, pathname } = useLocation();

	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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

		return () => {
			gsap.ticker.remove(onRaf);
			lenis.destroy();
			lenisRef.current = null;
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
