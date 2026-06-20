import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface FadeInProps {
	children: ReactNode;
	className?: string;
	/** Stagger delay (seconds). */
	delay?: number;
	/** Distance (px) the block travels up into place. */
	y?: number;
}

/**
 * Scroll-reveal wrapper (Framer Motion `whileInView`). Per-element via an
 * IntersectionObserver, so it's robust with async/data-driven content — the
 * right fit for dashboard pages (unlike capturing children at mount). Animates
 * once, ~15% into view. Reduced motion is honored by the app-level MotionConfig.
 */
export function FadeIn({
	children,
	className,
	delay = 0,
	y = 24,
}: FadeInProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, amount: 0.15, margin: "0px 0px -8% 0px" }}
			transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
			className={className}
		>
			{children}
		</motion.div>
	);
}
