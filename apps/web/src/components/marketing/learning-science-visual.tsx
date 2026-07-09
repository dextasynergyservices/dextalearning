import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { observeOnEnter } from "@/lib/reveal-on-enter";

gsap.registerPlugin(useGSAP);

// Review markers sit at the top of each spaced-recall "bounce".
const REVIEW_DOTS = [
	{ cx: 170, cy: 54 },
	{ cx: 300, cy: 50 },
	{ cx: 430, cy: 46 },
	{ cx: 560, cy: 42 },
];

// A forgetting curve (memory decays without review) vs. a spaced-recall curve
// (each review snaps retention back near 100%, and the dips get shallower over
// time — the durability blueprint §3 is built on). Paths draw in on scroll.
const DECAY = "M60 46 C 160 70, 260 150, 380 185 S 540 212, 600 216";
const SPACED =
	"M60 46 L150 92 L170 50 L280 88 L300 46 L410 82 L430 42 L540 76 L560 38 L600 40";
const SPACED_FILL = `${SPACED} L600 220 L60 220 Z`;

export function LearningScienceVisual() {
	const { t } = useTranslation("landing");
	const scope = useRef<HTMLDivElement>(null);

	useGSAP(
		() => {
			if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
			const root = scope.current;
			if (!root) return;

			const lines = gsap.utils.toArray<SVGPathElement>("[data-draw]", root);
			for (const line of lines) {
				const len = line.getTotalLength();
				gsap.set(line, { strokeDasharray: len, strokeDashoffset: len });
			}

			// Paused timeline played by an IntersectionObserver (not
			// ScrollTrigger — see lib/reveal-on-enter.ts): the draw-in can never
			// get stuck hidden after SPA navigation. Mirrors "top 78%".
			const timeline = gsap
				.timeline({ paused: true })
				.to(lines, {
					strokeDashoffset: 0,
					duration: 1.4,
					ease: "power2.out",
					stagger: 0.25,
				})
				.from(
					"[data-dot]",
					{ scale: 0, transformOrigin: "center", stagger: 0.12, duration: 0.3 },
					"-=0.7",
				)
				.from("[data-area]", { opacity: 0, duration: 0.8 }, "-=1");

			return observeOnEnter([root], () => timeline.play(), "0px 0px -22% 0px");
		},
		{ scope },
	);

	return (
		<div
			ref={scope}
			className="relative overflow-hidden rounded-card border border-border bg-card p-5 shadow-card sm:p-7"
		>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="font-display text-foreground text-sm">
					{t("principles.visual.title")}
				</p>
				<div className="flex items-center gap-4 text-xs">
					<span className="flex items-center gap-1.5 text-muted-foreground">
						<span className="size-2.5 rounded-full bg-brand-primary" />
						{t("principles.visual.spaced")}
					</span>
					<span className="flex items-center gap-1.5 text-muted-foreground">
						<span className="size-2.5 rounded-full bg-muted-foreground" />
						{t("principles.visual.decay")}
					</span>
				</div>
			</div>

			<svg
				viewBox="0 0 640 250"
				className="mt-4 w-full"
				role="img"
				aria-label={t("principles.visual.aria")}
			>
				<title>{t("principles.visual.aria")}</title>
				<defs>
					<linearGradient id="retention-fill" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.18" />
						<stop offset="100%" stopColor="#1d4ed8" stopOpacity="0" />
					</linearGradient>
				</defs>

				{/* Gridlines */}
				{[60, 100, 140, 180, 220].map((y) => (
					<line
						key={y}
						x1="60"
						x2="600"
						y1={y}
						y2={y}
						className="stroke-border"
						strokeWidth="1"
					/>
				))}

				{/* Axis labels */}
				<text x="30" y="50" className="fill-muted-foreground text-[11px]">
					100%
				</text>
				<text x="38" y="224" className="fill-muted-foreground text-[11px]">
					0%
				</text>

				<path data-area d={SPACED_FILL} fill="url(#retention-fill)" />
				<path
					data-draw
					d={DECAY}
					fill="none"
					className="stroke-muted-foreground"
					strokeWidth="2.5"
					strokeLinecap="round"
					strokeDasharray="6 7"
				/>
				<path
					data-draw
					d={SPACED}
					fill="none"
					className="stroke-brand-primary"
					strokeWidth="3"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>

				{REVIEW_DOTS.map((dot) => (
					<circle
						key={dot.cx}
						data-dot
						cx={dot.cx}
						cy={dot.cy}
						r="5"
						className="fill-card stroke-brand-primary"
						strokeWidth="3"
					/>
				))}

				<text x="150" y="244" className="fill-muted-foreground text-[11px]">
					{t("principles.visual.day", { n: 1 })}
				</text>
				<text x="540" y="244" className="fill-muted-foreground text-[11px]">
					{t("principles.visual.day", { n: 30 })}
				</text>
			</svg>
		</div>
	);
}
