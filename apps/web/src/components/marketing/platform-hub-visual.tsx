import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { observeOnEnter } from "@/lib/reveal-on-enter";

gsap.registerPlugin(useGSAP);

const CORE = { x: 320, y: 185 };

// Four academies fan out from a shared platform core (blueprint §2 — one engine,
// many academies). Teacher is live; the rest are upcoming.
const NODES = [
	{ key: "teacher", x: 120, y: 70, open: true },
	{ key: "tech", x: 520, y: 70, open: false },
	{ key: "business", x: 120, y: 300, open: false },
	{ key: "corporate", x: 520, y: 300, open: false },
];

export function PlatformHubVisual() {
	const { t } = useTranslation("landing");
	const scope = useRef<HTMLDivElement>(null);

	useGSAP(
		() => {
			if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
			const root = scope.current;
			if (!root) return;

			const lines = gsap.utils.toArray<SVGLineElement>("[data-link]", root);
			for (const line of lines) {
				const len = line.getTotalLength();
				gsap.set(line, { strokeDasharray: len, strokeDashoffset: len });
			}

			// Paused timeline played by an IntersectionObserver (not
			// ScrollTrigger — see lib/reveal-on-enter.ts): the diagram can never
			// get stuck hidden after SPA navigation. Mirrors "top 80%".
			const timeline = gsap
				.timeline({ paused: true })
				.from("[data-core]", {
					scale: 0,
					transformOrigin: "center",
					duration: 0.5,
					ease: "back.out(1.7)",
				})
				.to(
					lines,
					{ strokeDashoffset: 0, duration: 0.7, stagger: 0.1 },
					"-=0.1",
				)
				.from(
					"[data-node]",
					{
						scale: 0,
						transformOrigin: "center",
						stagger: 0.1,
						duration: 0.4,
						ease: "back.out(1.7)",
					},
					"-=0.4",
				);

			return observeOnEnter([root], () => timeline.play(), "0px 0px -20% 0px");
		},
		{ scope },
	);

	return (
		<div ref={scope} className="mx-auto w-full max-w-2xl">
			<svg
				viewBox="0 0 640 370"
				className="w-full"
				role="img"
				aria-label={t("academies.visual.aria")}
			>
				<title>{t("academies.visual.aria")}</title>

				{/* Connectors (drawn first, behind the nodes) */}
				{NODES.map((node) => (
					<line
						key={`link-${node.key}`}
						data-link
						x1={CORE.x}
						y1={CORE.y}
						x2={node.x}
						y2={node.y}
						className={node.open ? "stroke-brand-primary" : "stroke-slate-200"}
						strokeWidth="2"
						strokeDasharray={node.open ? undefined : "4 5"}
					/>
				))}

				{/* Core */}
				<g data-core>
					<circle
						cx={CORE.x}
						cy={CORE.y}
						r="52"
						className="fill-brand-primary"
					/>
					<circle
						cx={CORE.x}
						cy={CORE.y}
						r="52"
						className="fill-none stroke-brand-primary/30"
						strokeWidth="10"
					/>
					<text
						x={CORE.x}
						y={CORE.y - 2}
						textAnchor="middle"
						className="fill-white font-semibold text-[13px]"
					>
						Dexta
					</text>
					<text
						x={CORE.x}
						y={CORE.y + 15}
						textAnchor="middle"
						className="fill-white/80 text-[10px]"
					>
						{t("academies.visual.core")}
					</text>
				</g>

				{/* Academy nodes */}
				{NODES.map((node) => (
					<g key={node.key} data-node>
						<rect
							x={node.x - 78}
							y={node.y - 24}
							width="156"
							height="48"
							rx="12"
							className={
								node.open
									? "fill-white stroke-brand-primary"
									: "fill-white stroke-slate-200"
							}
							strokeWidth="1.5"
						/>
						<circle
							cx={node.x - 56}
							cy={node.y}
							r="6"
							className={node.open ? "fill-brand-primary" : "fill-slate-300"}
						/>
						<text
							x={node.x - 40}
							y={node.y - 1}
							className="fill-slate-800 font-semibold text-[12px]"
						>
							{t(`academies.items.${node.key}.name`)}
						</text>
						<text
							x={node.x - 40}
							y={node.y + 13}
							className={
								node.open
									? "fill-brand-primary text-[9px] uppercase"
									: "fill-slate-400 text-[9px] uppercase"
							}
						>
							{node.open ? t("academies.open") : t("academies.soon")}
						</text>
					</g>
				))}
			</svg>
		</div>
	);
}
