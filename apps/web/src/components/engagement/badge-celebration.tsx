import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { badgeMetaOf } from "@/components/engagement/badge-meta";
import {
	engagementKeys,
	getEngagementMe,
	markBadgesSeen,
} from "@/lib/engagement-api";
import { cn } from "@/lib/utils";

const PARTICLE_COLORS = [
	"bg-amber-400",
	"bg-orange-400",
	"bg-emerald-400",
	"bg-sky-400",
	"bg-rose-400",
	"bg-violet-400",
];

interface Particle {
	id: number;
	x: number;
	y: number;
	scale: number;
	color: string;
	delay: number;
}

function makeParticles(): Particle[] {
	return Array.from({ length: 14 }, (_, id) => {
		const angle = (id / 14) * Math.PI * 2 + Math.random() * 0.5;
		const distance = 70 + Math.random() * 60;
		return {
			id,
			x: Math.cos(angle) * distance,
			y: Math.sin(angle) * distance - 20,
			scale: 0.5 + Math.random() * 0.8,
			color: PARTICLE_COLORS[id % PARTICLE_COLORS.length],
			delay: Math.random() * 0.15,
		};
	});
}

/**
 * Full-screen badge celebration (§3.2 micro-wins): watches the signed-in
 * learner's unseen badges and plays them one at a time — backdrop fade,
 * medallion spring-pop, particle burst. Dismissing marks the badge seen so
 * it never replays. Mounted once in the learner shell.
 */
export function BadgeCelebration() {
	const { t } = useTranslation("engagement");
	const reducedMotion = useReducedMotion();
	const queryClient = useQueryClient();
	const { data } = useQuery({
		queryKey: engagementKeys.me,
		queryFn: getEngagementMe,
	});

	const [active, setActive] = useState<string | null>(null);
	const pending = useRef<string[]>([]);
	// Keys already queued this session — a refetch must not replay them.
	const handled = useRef(new Set<string>());
	const seen = useMutation({ mutationFn: markBadgesSeen });

	useEffect(() => {
		const fresh = (data?.unseenBadgeKeys ?? []).filter(
			(key) => !handled.current.has(key),
		);
		if (fresh.length === 0) return;
		for (const key of fresh) handled.current.add(key);
		pending.current.push(...fresh);
		setActive((current) => current ?? pending.current.shift() ?? null);
	}, [data?.unseenBadgeKeys]);

	const dismiss = () => {
		if (!active) return;
		seen.mutate([active]);
		const next = pending.current.shift() ?? null;
		setActive(next);
		if (!next) {
			void queryClient.invalidateQueries({ queryKey: engagementKeys.me });
		}
	};

	// Fresh burst per badge; skipped entirely under reduced motion.
	const particles = useMemo(
		() => (active && !reducedMotion ? makeParticles() : []),
		[active, reducedMotion],
	);

	const meta = active ? badgeMetaOf(active) : null;

	return (
		<AnimatePresence>
			{active && meta ? (
				<motion.div
					role="dialog"
					aria-modal="true"
					aria-label={t("celebration.unlocked")}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm"
					onClick={dismiss}
				>
					<motion.div
						key={active}
						initial={
							reducedMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0, y: 24 }
						}
						animate={
							reducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1, y: 0 }
						}
						exit={{ opacity: 0, scale: 0.9 }}
						transition={{ type: "spring", stiffness: 260, damping: 22 }}
						className="relative w-full max-w-xs rounded-card bg-card p-8 text-center shadow-card-hover"
						onClick={(event) => event.stopPropagation()}
					>
						<div className="relative mx-auto flex size-24 items-center justify-center">
							{particles.map((p) => (
								<motion.span
									key={p.id}
									initial={{ x: 0, y: 0, opacity: 1, scale: p.scale }}
									animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.2 }}
									transition={{
										duration: 0.9,
										delay: p.delay,
										ease: "easeOut",
									}}
									className={cn("absolute size-2.5 rounded-full", p.color)}
								/>
							))}
							<motion.span
								initial={reducedMotion ? undefined : { rotate: -12 }}
								animate={reducedMotion ? undefined : { rotate: 0 }}
								transition={{ type: "spring", stiffness: 260, damping: 22 }}
								className={cn(
									"flex size-24 items-center justify-center rounded-full text-white shadow-card-hover",
									meta.tint,
								)}
							>
								<meta.icon className="size-11" />
							</motion.span>
						</div>

						<p className="mt-5 font-stats font-semibold text-brand-primary text-xs uppercase tracking-wide">
							{t("celebration.unlocked")}
						</p>
						<h2 className="mt-1 font-display text-2xl text-foreground">
							{t(`badges.${active}.name`)}
						</h2>
						<p className="mt-1.5 text-muted-foreground text-sm">
							{t(`badges.${active}.desc`)}
						</p>

						<button
							type="button"
							onClick={dismiss}
							className="mt-6 w-full rounded-btn bg-brand-primary px-4 py-2.5 font-medium text-sm text-white transition-colors hover:bg-brand-primary/90"
						>
							{pending.current.length > 0
								? t("celebration.next")
								: t("celebration.cta")}
						</button>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
