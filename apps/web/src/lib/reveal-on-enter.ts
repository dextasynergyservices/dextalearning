/**
 * One-shot enter-viewport observer for entrance reveals.
 *
 * Why IntersectionObserver and not GSAP ScrollTrigger: ScrollTrigger caches
 * trigger start/end PIXEL positions, and on SPA navigation those go stale
 * (late font swaps, the ~220ms view-transition cross-fade, Lenis smoothing)
 * — a missed or mis-timed refresh could leave fold-adjacent sections stuck
 * at `opacity: 0` forever (see the gsap-scrolltrigger-spa-reveal saga; the
 * `once: true` + scheduled-refresh patch narrowed the race but reports kept
 * coming back). IO has no cached geometry to go stale: the browser ALWAYS
 * delivers an initial callback with the element's real, settled intersection
 * state, so anything already past the line reveals immediately and anything
 * below reveals the moment it truly enters. Each target fires exactly once.
 */
export function observeOnEnter(
	targets: Element[],
	onEnter: (target: Element, batchIndex: number) => void,
	rootMargin = "0px 0px -15% 0px",
): () => void {
	const io = new IntersectionObserver(
		(entries) => {
			// Elements entering in the same tick animate as one staggered batch,
			// in DOM order (IO entry order isn't guaranteed).
			const entering = entries
				.filter((entry) => entry.isIntersecting)
				.map((entry) => entry.target)
				.sort((a, b) =>
					a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
						? -1
						: 1,
				);
			entering.forEach((target, index) => {
				io.unobserve(target);
				onEnter(target, index);
			});
		},
		{ rootMargin },
	);
	for (const target of targets) io.observe(target);
	return () => io.disconnect();
}
