import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { type ReactNode, useRef } from "react";
import { observeOnEnter } from "@/lib/reveal-on-enter";

gsap.registerPlugin(useGSAP);

interface RevealProps {
	children: ReactNode;
	className?: string;
	/** Distance (px) the children travel up into place. */
	y?: number;
	/** Delay between each child's entrance. */
	stagger?: number;
}

/**
 * Wraps a block whose **direct children** fade and slide up as they scroll
 * into view (staggered in DOM order). A drop-in for list/grid/section content
 * on the public pages. Honors `prefers-reduced-motion` (blueprint §13.1):
 * when reduced motion is requested nothing animates and content renders in
 * place. Uses IntersectionObserver, not ScrollTrigger — see
 * `lib/reveal-on-enter.ts`.
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

			gsap.set(targets, { opacity: 0, y });

			// Mirrors the old ScrollTrigger `start: "top 84%"` line.
			return observeOnEnter(
				targets,
				(target, batchIndex) => {
					gsap.to(target, {
						opacity: 1,
						y: 0,
						duration: 0.7,
						ease: "power2.out",
						delay: batchIndex * stagger,
						overwrite: "auto",
					});
				},
				"0px 0px -16% 0px",
			);
		},
		{ scope },
	);

	return (
		<div ref={scope} className={className}>
			{children}
		</div>
	);
}
