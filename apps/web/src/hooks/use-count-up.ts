import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, useState } from "react";
import { scheduleScrollTriggerRefresh } from "@/lib/scroll-trigger-refresh";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Scroll-triggered number count-up animation. Counts from 0 to `end` when the
 * target element enters the viewport. Respects `prefers-reduced-motion`.
 *
 * @param end — The target number to count up to (e.g. 94, 3.5, 4).
 * @param options — Optional: `suffix` (e.g. "%", "x"), `duration` in seconds,
 *   `decimals` for decimal places.
 * @returns `{ ref, display }` — attach `ref` to the element, render `display`.
 */
export function useCountUp(
	end: number,
	options: { suffix?: string; duration?: number; decimals?: number } = {},
) {
	const { suffix = "", duration = 1.8, decimals = 0 } = options;
	const ref = useRef<HTMLElement>(null);
	const [display, setDisplay] = useState(`0${suffix}`);

	useGSAP(
		() => {
			if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
				setDisplay(`${end}${suffix}`);
				return;
			}
			const el = ref.current;
			if (!el) return;

			const counter = { value: 0 };
			gsap.to(counter, {
				value: end,
				duration,
				ease: "power2.out",
				scrollTrigger: { trigger: el, start: "top 85%", once: true },
				onUpdate: () => {
					setDisplay(
						`${decimals > 0 ? counter.value.toFixed(decimals) : Math.round(counter.value)}${suffix}`,
					);
				},
			});

			// See scheduleScrollTriggerRefresh: recompute once this route's
			// layout has truly settled so the count-up doesn't get stuck at 0.
			scheduleScrollTriggerRefresh();
		},
		{ scope: ref },
	);

	return { ref, display };
}
