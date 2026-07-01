import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Forces GSAP ScrollTrigger to recompute its cached trigger positions some
 * time after they were created. Needed because:
 *
 * 1. ScrollTrigger only auto-refreshes on the browser's `load` event, which
 *    never fires again on client-side route changes.
 * 2. The app navigates via the View Transitions API (`defaultViewTransition`),
 *    whose cross-fade keeps painting for ~220ms after the DOM swap — measuring
 *    layout before that settles can capture the wrong (pre-transition) sizes.
 * 3. Web fonts (and any async images) can swap in after mount, reflowing the
 *    page and invalidating positions computed before that reflow.
 *
 * `ScrollTrigger.refresh()` is a safe, idempotent, global call — fine to fire
 * more than once and harmless if the component that scheduled it has already
 * unmounted by the time it runs.
 */
export function scheduleScrollTriggerRefresh(): void {
	const refresh = () => ScrollTrigger.refresh();
	// Fast path: next paint, for plain navigations with no view transition.
	requestAnimationFrame(() => requestAnimationFrame(refresh));
	// Past the view-transition cross-fade (~220ms, see index.css `vt-fade-in`).
	setTimeout(refresh, 280);
	// Web fonts swapping in after mount.
	document.fonts?.ready.then(refresh).catch(() => {});
}
