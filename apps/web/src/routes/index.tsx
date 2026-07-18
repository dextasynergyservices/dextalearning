import { useQuery } from "@tanstack/react-query";
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
import { Carousel } from "@/components/catalog/carousel";
import {
	PublicCohortCard,
	PublicCourseCard,
	PublicPathCard,
} from "@/components/catalog/public-cards";
import { PublicShell } from "@/components/layout/public-shell";
import { LearningScienceVisual } from "@/components/marketing/learning-science-visual";
import { PlatformHubVisual } from "@/components/marketing/platform-hub-visual";
import { buttonVariants } from "@/components/ui/button";
import { useCountUp } from "@/hooks/use-count-up";
import { useReveal } from "@/hooks/use-reveal";
import { useSession } from "@/lib/auth-client";
import {
	type FeaturedCatalog,
	getFeatured,
	getRecommended,
} from "@/lib/content-api";
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
			<Featured />
			<Recommended />
			<HowItWorks />
			<Stories />
			<StatsStrip />
			<CtaBand />
		</PublicShell>
	);
}

/** Shared homepage shelves (carousels) for Featured / Recommended. */
function CatalogShelves({
	queryKey,
	queryFn,
	titles,
	personalizedNotes,
	bg = "bg-muted",
}: {
	queryKey: string;
	queryFn: () => Promise<FeaturedCatalog>;
	titles: { courses: string; paths: string; cohorts: string };
	/** Per-shelf subtitle shown only when that shelf is personalised. */
	personalizedNotes?: { courses: string; paths: string; cohorts: string };
	bg?: string;
}) {
	const { data } = useQuery({ queryKey: [queryKey], queryFn });

	if (
		!data ||
		(data.courses.length === 0 &&
			data.paths.length === 0 &&
			data.cohorts.length === 0)
	) {
		return null;
	}

	return (
		<section className={cn("py-14 lg:py-20", bg)}>
			<div className="mx-auto max-w-7xl space-y-12 px-6 lg:px-8">
				{data.courses.length > 0 ? (
					<Shelf
						title={titles.courses}
						subtitle={
							data.personalized?.courses
								? personalizedNotes?.courses
								: undefined
						}
						seeAllTo="/teachers/courses"
					>
						<Carousel
							items={data.courses}
							getKey={(c) => c.id}
							render={(course) => <PublicCourseCard course={course} />}
						/>
					</Shelf>
				) : null}
				{data.paths.length > 0 ? (
					<Shelf
						title={titles.paths}
						subtitle={
							data.personalized?.paths ? personalizedNotes?.paths : undefined
						}
						seeAllTo="/teachers/paths"
					>
						<Carousel
							items={data.paths}
							getKey={(p) => p.id}
							render={(path) => <PublicPathCard path={path} />}
						/>
					</Shelf>
				) : null}
				{data.cohorts.length > 0 ? (
					<Shelf
						title={titles.cohorts}
						subtitle={
							data.personalized?.cohorts
								? personalizedNotes?.cohorts
								: undefined
						}
						seeAllTo="/teachers/cohorts"
					>
						<Carousel
							items={data.cohorts}
							getKey={(c) => c.id}
							render={(cohort) => <PublicCohortCard cohort={cohort} />}
						/>
					</Shelf>
				) : null}
			</div>
		</section>
	);
}

/** Curated "Featured" shelves — admin-approved content. */
function Featured() {
	const { t } = useTranslation("academy");
	return (
		<CatalogShelves
			queryKey="featured"
			queryFn={getFeatured}
			titles={{
				courses: t("featured.courses", { defaultValue: "Featured courses" }),
				paths: t("featured.paths", { defaultValue: "Featured paths" }),
				cohorts: t("featured.cohorts", { defaultValue: "Featured cohorts" }),
			}}
		/>
	);
}

/** "Recommended" shelves — personalised when signed in, else popular. */
function Recommended() {
	const { t } = useTranslation("academy");
	const { data: session } = useSession();
	return (
		<CatalogShelves
			queryKey={`recommended-${session?.user?.id ?? "anon"}`}
			queryFn={getRecommended}
			bg="bg-background"
			personalizedNotes={{
				courses: t("recommended.because_collab", {
					defaultValue:
						"Because learners who enrolled in your courses also enrolled in these",
				}),
				paths: t("recommended.because_collab_paths", {
					defaultValue:
						"Because learners who enrolled in your paths also enrolled in these",
				}),
				cohorts: t("recommended.because_collab_cohorts", {
					defaultValue:
						"Because learners who joined your cohorts also joined these",
				}),
			}}
			titles={{
				courses: t("recommended.courses", {
					defaultValue: "Recommended courses",
				}),
				paths: t("recommended.paths", { defaultValue: "Recommended paths" }),
				cohorts: t("recommended.cohorts", {
					defaultValue: "Recommended cohorts",
				}),
			}}
		/>
	);
}

function Shelf({
	title,
	subtitle,
	seeAllTo,
	children,
}: {
	title: string;
	subtitle?: string;
	seeAllTo: "/teachers/courses" | "/teachers/paths" | "/teachers/cohorts";
	children: ReactNode;
}) {
	const { t } = useTranslation("academy");
	return (
		<div>
			<div className="mb-4 flex items-end justify-between gap-4">
				<div className="min-w-0">
					<h2 className="font-display text-2xl text-foreground sm:text-3xl">
						{title}
					</h2>
					{subtitle ? (
						<p className="mt-1 text-muted-foreground text-sm">{subtitle}</p>
					) : null}
				</div>
				<Link
					to={seeAllTo}
					className="flex shrink-0 items-center gap-1 font-semibold text-brand-primary text-sm transition-all hover:gap-1.5"
				>
					{t("featured.see_all", { defaultValue: "See all" })}
					<ArrowRight className="size-4" />
				</Link>
			</div>
			{children}
		</div>
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
	"bg-brand-primary/70",
	"bg-brand-accent/55",
	"bg-hero-surface/70",
	"bg-brand-primary-hover/65",
	"bg-brand-accent-hover/55",
	"bg-hero-card/65",
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
		<section className="relative overflow-hidden bg-hero-bg text-white">
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
					className="mt-3 font-display text-3xl tracking-tight text-foreground sm:text-4xl"
				>
					{t("principles.title")}
				</h2>
				<p data-reveal className="mt-4 text-lg text-muted-foreground">
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
						className="group rounded-card border border-border bg-card p-7 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
					>
						<span className="flex size-12 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary transition-colors group-hover:bg-brand-solid-hover group-hover:text-white">
							<Icon className="size-6" />
						</span>
						<h3 className="mt-5 font-display text-xl text-foreground">
							{t(`principles.items.${key}.title`)}
						</h3>
						<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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
		<RevealSection className="bg-muted">
			<div className="mx-auto max-w-7xl px-6 py-10 lg:px-8 lg:py-14">
				<div className="mx-auto max-w-2xl text-center">
					<h2
						data-reveal
						className="font-display text-3xl tracking-tight text-foreground sm:text-4xl"
					>
						{t("academies.title")}
					</h2>
					<p data-reveal className="mt-4 text-lg text-muted-foreground">
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
								"flex flex-col rounded-card border bg-card p-7 shadow-card transition-all",
								open
									? "border-brand-primary/30 hover:-translate-y-1 hover:shadow-card-hover"
									: "border-border",
							)}
						>
							<div className="flex items-center justify-between">
								<span className="flex size-11 items-center justify-center rounded-btn bg-foreground text-background">
									<Icon className="size-5" />
								</span>
								<span className={open ? "badge-open" : "badge-soon"}>
									{open ? t("academies.open") : t("academies.soon")}
								</span>
							</div>
							<h3 className="mt-5 font-display text-lg text-foreground">
								{t(`academies.items.${key}.name`)}
							</h3>
							<p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
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
								<span className="mt-5 text-sm font-medium text-muted-foreground">
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
					className="font-display text-3xl tracking-tight text-foreground sm:text-4xl"
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
						<h3 className="mt-2 font-display text-xl text-foreground">
							{t(`how.items.${key}.title`)}
						</h3>
						<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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
		<RevealSection className="bg-muted">
			<div className="mx-auto max-w-7xl px-6 py-10 lg:px-8 lg:py-14">
				<div className="mx-auto max-w-2xl text-center">
					<h2
						data-reveal
						className="font-display text-3xl tracking-tight text-foreground sm:text-4xl"
					>
						{t("stories.title")}
					</h2>
				</div>
				<div className="mt-10">
					<Carousel
						items={STORY_KEYS}
						getKey={(key) => key}
						itemClassName="w-[85%] sm:w-[48%] lg:w-[32%]"
						render={(key) => (
							<figure className="flex h-full flex-col rounded-card border border-border bg-card p-7 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
								<Quote className="size-7 text-brand-accent" />
								<blockquote className="mt-4 flex-1 text-foreground">
									"{t(`stories.items.${key}.quote`)}"
								</blockquote>
								<figcaption className="mt-6 flex items-center gap-1">
									<div>
										<p className="font-semibold text-foreground">
											{t(`stories.items.${key}.name`)}
										</p>
										<p className="text-sm text-muted-foreground">
											{t(`stories.items.${key}.role`)}
										</p>
									</div>
									<div className="ml-auto flex text-brand-accent">
										{[0, 1, 2, 3, 4].map((s) => (
											<Star key={s} className="size-4 fill-current" />
										))}
									</div>
								</figcaption>
							</figure>
						)}
					/>
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
				className="rounded-card bg-brand-solid px-8 py-16 text-center text-white shadow-card lg:py-20"
			>
				<h2 className="font-display text-3xl tracking-tight sm:text-4xl">
					{t("cta.title")}
				</h2>
				<p className="mx-auto mt-4 max-w-xl text-blue-100">
					{t("cta.subtitle")}
				</p>
				<div className="mt-8 flex justify-center">
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
