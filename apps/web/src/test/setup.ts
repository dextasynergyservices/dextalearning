import { cleanup, configure } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// `globals: false` (vitest.config.ts) means RTL's auto-cleanup detection
// doesn't kick in — register it explicitly so each test starts unmounted.
afterEach(() => {
	cleanup();
});

// RTL's default findBy*/waitFor timeout (1000ms) is too tight once many
// spec files mount jsdom + the full renderRoute() app tree in parallel under
// the suite's own CPU contention — individual tests pass in isolation but
// intermittently time out in a full `bun run test` run. Bumped once, here,
// rather than adding a `{ timeout: ... }` override to every assertion as
// this class of flake keeps resurfacing.
configure({ asyncUtilTimeout: 5000 });

// jsdom doesn't implement matchMedia. The root layout's useSmoothScroll hook
// registers GSAP's ScrollTrigger plugin on mount, which calls it immediately —
// so any test rendering the real route tree (renderRoute) needs this stub,
// not just tests that explicitly touch scroll behavior.
if (typeof window !== "undefined" && !window.matchMedia) {
	window.matchMedia = (query: string) =>
		({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}) as unknown as MediaQueryList;
}

// jsdom doesn't implement ResizeObserver either — used by layout components
// (e.g. the desktop/mobile breakpoint + carousel logic) that mount as part of
// the real root layout when a full route is rendered via renderRoute.
if (typeof globalThis.ResizeObserver === "undefined") {
	globalThis.ResizeObserver = class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
}

// jsdom logs a noisy "not implemented" console error for scrollTo — the
// router's `scrollRestoration: true` calls it on every navigation in tests.
if (typeof window !== "undefined") {
	window.scrollTo = () => {};
}

// Same story for Element.scrollBy (e.g. the catalog Carousel's prev/next arrows)
// and Element.scrollTo (e.g. TranscriptPanel centering the active cue).
if (typeof Element !== "undefined" && !Element.prototype.scrollBy) {
	Element.prototype.scrollBy = () => {};
}
if (typeof Element !== "undefined" && !Element.prototype.scrollTo) {
	Element.prototype.scrollTo = () => {};
}

// jsdom doesn't implement IntersectionObserver — used by PagedGrid's mobile
// infinite-scroll sentinel.
if (typeof globalThis.IntersectionObserver === "undefined") {
	globalThis.IntersectionObserver = class IntersectionObserver {
		root = null;
		rootMargin = "";
		thresholds: number[] = [];
		observe() {}
		unobserve() {}
		disconnect() {}
		takeRecords() {
			return [];
		}
	} as unknown as typeof globalThis.IntersectionObserver;
}

// jsdom's Range doesn't implement getClientRects/getBoundingClientRect —
// ProseMirror (RichTextEditor's Tiptap editor) calls these during
// scrollIntoView after every transaction dispatch, throwing otherwise.
if (typeof Range !== "undefined") {
	if (!Range.prototype.getBoundingClientRect) {
		Range.prototype.getBoundingClientRect = () =>
			({
				x: 0,
				y: 0,
				width: 0,
				height: 0,
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				toJSON() {},
			}) as DOMRect;
	}
	if (!Range.prototype.getClientRects) {
		Range.prototype.getClientRects = () =>
			({
				length: 0,
				item: () => null,
				[Symbol.iterator]: function* () {},
			}) as unknown as DOMRectList;
	}
}

// jsdom doesn't implement document.elementFromPoint — ProseMirror's mousedown
// handler (RichTextEditor's Tiptap editor) calls it to resolve a click to a
// document position.
if (typeof document !== "undefined" && !document.elementFromPoint) {
	document.elementFromPoint = () => null;
}

// jsdom's SVG elements don't implement getTotalLength — the homepage's
// decorative SVG illustrations (LearningScienceVisual, PlatformHubVisual)
// call it via GSAP to set up a stroke-draw animation on mount. Without this,
// any renderRoute("/") call throws and the whole page falls back to
// TanStack Router's error boundary.
if (
	typeof SVGElement !== "undefined" &&
	!("getTotalLength" in SVGElement.prototype)
) {
	Object.defineProperty(SVGElement.prototype, "getTotalLength", {
		value: () => 0,
		writable: true,
		configurable: true,
	});
}
