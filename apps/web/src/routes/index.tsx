import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
	ArrowRight,
	Brain,
	Briefcase,
	Building2,
	Code2,
	Coins,
	GraduationCap,
	Quote,
	Repeat,
	Star,
	Target,
	TrendingUp,
	Users,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PublicShell } from "@/components/layout/public-shell";
import { LearningScienceVisual } from "@/components/marketing/learning-science-visual";
import { PlatformHubVisual } from "@/components/marketing/platform-hub-visual";
import { buttonVariants } from "@/components/ui/button";
import { useCountUp } from "@/hooks/use-count-up";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
	component: LandingPage,
});

function LandingPage() {
	return (
		<PublicShell darkHeader>
			<Hero />
			<Principles />
			<Academies />
			<HowItWorks />
			<Stories />
			<StatsStrip />
			<CtaBand />
		</PublicShell>
	);
}

/** Section wrapper that fades its `data-reveal` children in on scroll. */
function RevealSection({
	children,
	className,
	id,
}: {
	children: ReactNode;
	className?: string;
	id?: string;
}) {
	const ref = useReveal<HTMLElement>();
	return (
		<section ref={ref} id={id} className={className}>
			{children}
		</section>
	);
}

// Duotone learner-portrait tiles forming the hero's bento grid (ALX-style).
// Placeholder photos for now; real images drop into the same `src`s later.
// Each tile is grayscaled then multiplied with a brand-family tint.
const HERO_TINTS = [
	"bg-blue-600/70",
	"bg-emerald-500/60",
	"bg-violet-600/65",
	"bg-amber-500/55",
	"bg-indigo-700/70",
	"bg-sky-600/60",
];

const HERO_TILES = [
	11, 12, 13, 14, 15, 16, 31, 32, 33, 45, 47, 51, 5, 60, 68,
].map((img, index) => ({
	id: `tile-${img}`,
	src: `https://i.pravatar.cc/240?img=${img}`,
	tint: HERO_TINTS[index % HERO_TINTS.length],
}));

// Split the tiles into 5 vertical columns and step each one higher than the
// last, so the block reads as an ascending staircase (growth / "level up").
const HERO_COLUMNS = [0, 1, 2, 3, 4].map((ci) => [
	HERO_TILES[ci],
	HERO_TILES[ci + 5],
	HERO_TILES[ci + 10],
]);

const COLUMN_RISE = [
	"mt-10 lg:mt-24",
	"mt-7 lg:mt-[4.5rem]",
	"mt-5 lg:mt-12",
	"mt-2 lg:mt-6",
	"mt-0",
];

function HeroPhotoGrid() {
	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.97 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ duration: 0.7, delay: 0.2 }}
			className="flex justify-center gap-1.5 lg:gap-2"
		>
			{HERO_COLUMNS.map((column, ci) => (
				<div
					key={column[0].id}
					className={cn(
						"flex w-16 flex-col gap-1.5 sm:w-24 lg:w-32 lg:gap-2",
						COLUMN_RISE[ci],
					)}
				>
					{column.map((tile, ti) => (
						<motion.div
							key={tile.id}
							initial={{ opacity: 0, y: 24 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{
								duration: 0.5,
								delay: 0.3 + ci * 0.08 + ti * 0.06,
							}}
							className="relative aspect-square overflow-hidden rounded-md"
						>
							<img
								src={tile.src}
								alt=""
								loading="lazy"
								className="size-full object-cover grayscale"
							/>
							<div
								className={cn("absolute inset-0 mix-blend-multiply", tile.tint)}
							/>
						</motion.div>
					))}
				</div>
			))}
		</motion.div>
	);
}

function Hero() {
	const { t } = useTranslation(["landing", "common"]);

	return (
		<section className="relative overflow-hidden bg-gradient-to-br from-[#0b1640] via-[#0a1130] to-[#070a1c] text-white">
			{/* Ambient glow effects */}
			<div className="pointer-events-none absolute -top-40 -left-32 size-[28rem] rounded-full bg-brand-primary/20 blur-[120px]" />
			<div className="pointer-events-none absolute bottom-0 -right-20 size-[22rem] rounded-full bg-brand-accent/10 blur-[100px]" />

			<div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_1.15fr] lg:gap-6">
				{/* Headline */}
				<div className="px-6 pt-24 pb-8 lg:py-32 lg:pl-8">
					<motion.h1
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6 }}
						className="font-display text-5xl leading-[1.0] tracking-tight sm:text-6xl lg:text-7xl"
					>
						{t("hero.title_lead")}{" "}
						<span className="text-brand-accent">
							{t("hero.title_highlight")}
						</span>
					</motion.h1>

					<motion.p
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.12 }}
						className="mt-5 max-w-md text-base text-slate-300 sm:text-lg"
					>
						{t("hero.subtitle")}
					</motion.p>

					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.22 }}
						className="mt-8 flex flex-col gap-3 sm:flex-row"
					>
						<Link
							to="/register"
							className={buttonVariants({ variant: "accent", size: "lg" })}
						>
							{t("common:actions.start_free")} <ArrowRight className="size-4" />
						</Link>
						<Link
							to="/teachers/courses"
							className={buttonVariants({ variant: "white", size: "lg" })}
						>
							{t("common:actions.explore_courses")}
						</Link>
					</motion.div>
				</div>

				{/* Duotone portrait grid — fills the right half (band below on mobile).
				    Extra lg top padding so the staircase clears the fixed header. */}
				<div className="pb-10 lg:pt-28 lg:pr-4 lg:pb-12">
					<HeroPhotoGrid />
				</div>
			</div>
		</section>
	);
}

const PRINCIPLE_ITEMS: {
	key: string;
	icon: ComponentType<{ className?: string }>;
}[] = [
	{ key: "recall", icon: Repeat },
	{ key: "spaced", icon: Brain },
	{ key: "earnback", icon: Coins },
	{ key: "cohorts", icon: Users },
	{ key: "pacing", icon: Target },
	{ key: "growth", icon: TrendingUp },
];

function Principles() {
	const { t } = useTranslation("landing");
	return (
		<RevealSection className="mx-auto max-w-7xl px-6 py-10 lg:px-8 lg:py-14">
			<div className="mx-auto max-w-2xl text-center">
				<p
					data-reveal
					className="font-stats text-sm font-semibold tracking-wider text-brand-primary uppercase"
				>
					{t("principles.eyebrow")}
				</p>
				<h2
					data-reveal
					className="mt-3 font-display text-3xl tracking-tight text-slate-900 sm:text-4xl"
				>
					{t("principles.title")}
				</h2>
				<p data-reveal className="mt-4 text-lg text-slate-500">
					{t("principles.subtitle")}
				</p>
			</div>

			{/* Retention curve: spaced recall vs. the forgetting curve. */}
			<div data-reveal="scale" className="mx-auto mt-10 max-w-3xl">
				<LearningScienceVisual />
			</div>

			<div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{PRINCIPLE_ITEMS.map(({ key, icon: Icon }, i) => (
					<div
						key={key}
						data-reveal={i % 2 === 0 ? "left" : "right"}
						className="group rounded-card border border-slate-200 bg-white p-7 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
					>
						<span className="flex size-12 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary transition-colors group-hover:bg-brand-primary group-hover:text-white">
							<Icon className="size-6" />
						</span>
						<h3 className="mt-5 font-display text-xl text-slate-900">
							{t(`principles.items.${key}.title`)}
						</h3>
						<p className="mt-2 text-sm leading-relaxed text-slate-500">
							{t(`principles.items.${key}.body`)}
						</p>
					</div>
				))}
			</div>
		</RevealSection>
	);
}

const ACADEMY_ITEMS: {
	key: string;
	icon: ComponentType<{ className?: string }>;
	open: boolean;
}[] = [
	{ key: "teacher", icon: GraduationCap, open: true },
	{ key: "tech", icon: Code2, open: false },
	{ key: "business", icon: Briefcase, open: false },
	{ key: "corporate", icon: Building2, open: false },
];

function Academies() {
	const { t } = useTranslation("landing");
	return (
		<RevealSection className="bg-slate-50">
			<div className="mx-auto max-w-7xl px-6 py-10 lg:px-8 lg:py-14">
				<div className="mx-auto max-w-2xl text-center">
					<h2
						data-reveal
						className="font-display text-3xl tracking-tight text-slate-900 sm:text-4xl"
					>
						{t("academies.title")}
					</h2>
					<p data-reveal className="mt-4 text-lg text-slate-500">
						{t("academies.subtitle")}
					</p>
				</div>

				{/* Hub-and-spoke: one platform core, many academies. */}
				<div data-reveal="scale" className="mt-10">
					<PlatformHubVisual />
				</div>

				<div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
					{ACADEMY_ITEMS.map(({ key, icon: Icon, open }) => (
						<div
							key={key}
							data-reveal="scale"
							className={cn(
								"flex flex-col rounded-card border bg-white p-7 shadow-card transition-all",
								open
									? "border-brand-primary/30 hover:-translate-y-1 hover:shadow-card-hover"
									: "border-slate-200",
							)}
						>
							<div className="flex items-center justify-between">
								<span className="flex size-11 items-center justify-center rounded-btn bg-slate-900 text-white">
									<Icon className="size-5" />
								</span>
								<span className={open ? "badge-open" : "badge-soon"}>
									{open ? t("academies.open") : t("academies.soon")}
								</span>
							</div>
							<h3 className="mt-5 font-display text-lg text-slate-900">
								{t(`academies.items.${key}.name`)}
							</h3>
							<p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">
								{t(`academies.items.${key}.blurb`)}
							</p>
							{open ? (
								<Link
									to="/teachers"
									className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-primary hover:gap-2 transition-all"
								>
									{t("academies.enter")} <ArrowRight className="size-4" />
								</Link>
							) : (
								<span className="mt-5 text-sm font-medium text-slate-400">
									{t("academies.coming")}
								</span>
							)}
						</div>
					))}
				</div>
			</div>
		</RevealSection>
	);
}

const STEP_ITEMS = [
	{ key: "goal", n: "01" },
	{ key: "learn", n: "02" },
	{ key: "finish", n: "03" },
];

function HowItWorks() {
	const { t } = useTranslation("landing");
	return (
		<RevealSection className="mx-auto max-w-7xl px-6 py-10 lg:px-8 lg:py-14">
			<div className="mx-auto max-w-2xl text-center">
				<h2
					data-reveal
					className="font-display text-3xl tracking-tight text-slate-900 sm:text-4xl"
				>
					{t("how.title")}
				</h2>
			</div>
			<div className="mt-10 grid gap-8 lg:grid-cols-3">
				{STEP_ITEMS.map(({ key, n }, i) => (
					<div
						key={key}
						data-reveal={i === 0 ? "left" : i === 2 ? "right" : ""}
						className="relative"
					>
						<span className="font-display text-5xl text-brand-primary/15">
							{n}
						</span>
						<h3 className="mt-2 font-display text-xl text-slate-900">
							{t(`how.items.${key}.title`)}
						</h3>
						<p className="mt-2 text-sm leading-relaxed text-slate-500">
							{t(`how.items.${key}.body`)}
						</p>
					</div>
				))}
			</div>
		</RevealSection>
	);
}

const STORY_KEYS = ["one", "two", "three"];

function Stories() {
	const { t } = useTranslation("landing");
	return (
		<RevealSection className="bg-slate-50">
			<div className="mx-auto max-w-7xl px-6 py-10 lg:px-8 lg:py-14">
				<div className="mx-auto max-w-2xl text-center">
					<h2
						data-reveal
						className="font-display text-3xl tracking-tight text-slate-900 sm:text-4xl"
					>
						{t("stories.title")}
					</h2>
				</div>
				<div className="mt-10 grid gap-6 lg:grid-cols-3">
					{STORY_KEYS.map((key, i) => (
						<figure
							key={key}
							data-reveal={i === 0 ? "left" : i === 2 ? "right" : ""}
							className="flex flex-col rounded-card border border-slate-200 bg-white p-7 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
						>
							<Quote className="size-7 text-brand-accent" />
							<blockquote className="mt-4 flex-1 text-slate-700">
								"{t(`stories.items.${key}.quote`)}"
							</blockquote>
							<figcaption className="mt-6 flex items-center gap-1">
								<div>
									<p className="font-semibold text-slate-900">
										{t(`stories.items.${key}.name`)}
									</p>
									<p className="text-sm text-slate-500">
										{t(`stories.items.${key}.role`)}
									</p>
								</div>
								<div className="ml-auto flex text-brand-accent">
									{[0, 1, 2, 3, 4].map((i) => (
										<Star key={i} className="size-4 fill-current" />
									))}
								</div>
							</figcaption>
						</figure>
					))}
				</div>
			</div>
		</RevealSection>
	);
}

/** Individual stat with count-up animation. */
function StatItem({
	end,
	suffix,
	decimals,
	label,
}: {
	end: number;
	suffix?: string;
	decimals?: number;
	label: string;
}) {
	const { ref, display } = useCountUp(end, { suffix, decimals });
	return (
		<div className="text-center">
			<p
				ref={ref as React.RefObject<HTMLParagraphElement>}
				className="font-stats text-4xl font-bold text-brand-accent sm:text-5xl"
			>
				{display}
			</p>
			<p className="mt-2 text-sm text-slate-300">{label}</p>
		</div>
	);
}

/** Stats strip — placed AFTER transformation stories per blueprint §9.5. */
function StatsStrip() {
	const { t } = useTranslation("landing");
	return (
		<RevealSection className="bg-hero-bg text-white">
			<div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
				<StatItem
					end={94}
					suffix="%"
					label={t("stats.items.completion.label")}
				/>
				<StatItem end={4} suffix="×" label={t("stats.items.recall.label")} />
				<StatItem end={15} suffix="min" label={t("stats.items.lesson.label")} />
				<StatItem end={4} label={t("stats.items.languages.label")} />
			</div>
		</RevealSection>
	);
}

function CtaBand() {
	const { t } = useTranslation("landing");
	return (
		<RevealSection className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
			<div
				data-reveal="scale"
				className="relative overflow-hidden rounded-card bg-brand-primary px-8 py-16 text-center text-white lg:py-20"
			>
				<div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand-accent/30 blur-[100px]" />
				<div className="pointer-events-none absolute -bottom-16 -left-16 size-56 rounded-full bg-white/10 blur-[80px]" />
				<h2 className="relative font-display text-3xl tracking-tight sm:text-4xl">
					{t("cta.title")}
				</h2>
				<p className="relative mx-auto mt-4 max-w-xl text-blue-100">
					{t("cta.subtitle")}
				</p>
				<div className="relative mt-8 flex justify-center">
					<Link
						to="/register"
						className={buttonVariants({ variant: "accent", size: "lg" })}
					>
						{t("cta.button")} <ArrowRight className="size-4" />
					</Link>
				</div>
			</div>
		</RevealSection>
	);
}
