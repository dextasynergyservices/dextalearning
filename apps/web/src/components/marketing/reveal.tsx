import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type ReactNode, useRef } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

interface RevealProps {
	children: ReactNode;
	className?: string;
	/** Distance (px) the children travel up into place. */
	y?: number;
	/** Delay between each child's entrance. */
	stagger?: number;
}

/**
 * Wraps a block whose **direct children** fade and slide up as it scrolls into
 * view (staggered in DOM order). A drop-in for list/grid/section content on the
 * public pages. Honors `prefers-reduced-motion` (blueprint §13.1): when reduced
 * motion is requested nothing animates and content renders in place.
 */
export function Reveal({
	children,
	className,
	y = 28,
	stagger = 0.09,
}: RevealProps) {
	const scope = useRef<HTMLDivElement>(null);

	useGSAP(
		() => {
			if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
			const el = scope.current;
			if (!el) return;
			const targets = Array.from(el.children);
			if (targets.length === 0) return;

			gsap.from(targets, {
				opacity: 0,
				y,
				duration: 0.7,
				ease: "power2.out",
				stagger,
				scrollTrigger: { trigger: el, start: "top 84%" },
			});
		},
		{ scope },
	);

	return (
		<div ref={scope} className={className}>
			{children}
		</div>
	);
}
