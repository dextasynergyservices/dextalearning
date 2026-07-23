import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
	ArrowRight,
	Award,
	Brain,
	Compass,
	Flame,
	GraduationCap,
	Lightbulb,
	PlayCircle,
	Repeat2,
	Target,
} from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Carousel } from "@/components/catalog/carousel";
import { PublicCourseCard } from "@/components/catalog/public-cards";
import { CoachCard } from "@/components/engagement/coach-card";
import { NextBadgeNudge } from "@/components/engagement/next-badge-nudge";
import { StreakPanel } from "@/components/engagement/streak-panel";
import { LearnerShell } from "@/components/layout/learner-shell";
import { InstructorApplicationStatus } from "@/components/learn/instructor-application-status";
import { MyLearningCard } from "@/components/learn/my-learning-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth-client";
import { getMyLearning, getPublishedCourses } from "@/lib/content-api";
import { engagementKeys, getEngagementMe } from "@/lib/engagement-api";

export const Route = createFileRoute("/dashboard")({
	component: DashboardPage,
});

const STAT_META: {
	key: string;
	icon: ComponentType<{ className?: string }>;
	tint: string;
}[] = [
	{
		key: "streak",
		icon: Flame,
		tint: "bg-brand-accent-light text-brand-accent",
	},
	{
		key: "courses",
		icon: GraduationCap,
		tint: "bg-brand-primary-light text-brand-primary",
	},
	{
		key: "certificates",
		icon: Award,
		tint: "bg-muted text-foreground",
	},
];

const LEARNING_TIPS: {
	key: string;
	icon: ComponentType<{ className?: string }>;
	tint: string;
}[] = [
	{
		key: "recall",
		icon: Brain,
		tint: "bg-brand-primary-light text-brand-primary",
	},
	{
		key: "spacing",
		icon: Repeat2,
		tint: "bg-brand-accent-light text-brand-accent",
	},
	{
		key: "focus",
		icon: Target,
		tint: "bg-muted text-foreground",
	},
];

const containerMotion = {
	hidden: { opacity: 0 },
	show: {
		opacity: 1,
		transition: { staggerChildren: 0.08 },
	},
};

const itemMotion = {
	hidden: { opacity: 0, y: 16 },
	show: { opacity: 1, y: 0, transition: { duration: 0.38 } },
};

function firstNameOf(name?: string | null): string {
	return name?.trim()?.split(" ")[0] ?? "";
}

function DashboardPage() {
	const { t } = useTranslation(["dashboard", "authoring"]);
	const { data: session } = useSession();
	const firstName = firstNameOf(session?.user.name);
	const { data: courses, isPending: coursesLoading } = useQuery({
		queryKey: ["published-courses"],
		queryFn: () => getPublishedCourses(),
		staleTime: 0,
		refetchOnMount: "always",
	});
	const { data: mine } = useQuery({
		queryKey: ["my-learning"],
		queryFn: getMyLearning,
	});
	const { data: engagement } = useQuery({
		queryKey: engagementKeys.me,
		queryFn: getEngagementMe,
	});
	const allMine = mine ? [...mine.courses, ...mine.paths, ...mine.cohorts] : [];
	const inProgress = allMine.filter((i) => !i.isComplete).slice(0, 3);
	const statValues: Record<string, number> = {
		streak: engagement?.streak.current ?? 0,
		courses: allMine.filter((i) => !i.isComplete).length,
		// Certificates issue in the payments phase — until then this stays 0.
		certificates: 0,
	};

	return (
		<LearnerShell title={t("home.greeting")}>
			<motion.div
				variants={containerMotion}
				initial="hidden"
				animate="show"
				className="space-y-6 pt-4 lg:space-y-8 lg:pt-7"
			>
				{/* Where an instructor application stands — first thing they see,
				    and self-hiding for everyone who never applied (§8.1.1). */}
				<motion.div variants={itemMotion}>
					<InstructorApplicationStatus />
				</motion.div>

				<motion.section
					variants={itemMotion}
					className="rounded-card border border-brand-primary/15 bg-card p-4 shadow-card sm:p-6"
				>
					<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
						<div className="min-w-0">
							<p className="font-stats font-semibold text-brand-primary text-xs uppercase">
								{t("home.greeting")}
							</p>
							<h2 className="mt-2 font-display text-2xl leading-tight text-foreground sm:text-3xl">
								{firstName ? `${firstName}, ` : ""}
								{t("home.subtitle")}
							</h2>
							<p className="mt-2 max-w-xl text-muted-foreground text-sm leading-relaxed">
								{t("home.tip_body")}
							</p>
						</div>
						<a
							href="#explore"
							className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-btn bg-brand-solid px-5 font-semibold text-sm text-white transition-colors hover:bg-brand-solid-hover active:scale-[0.98]"
						>
							<Compass className="size-4" />
							{t("home.browse_cta")}
						</a>
					</div>

					<div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
						{STAT_META.map(({ key, icon: Icon, tint }) => (
							<motion.div
								key={key}
								whileHover={{ y: -2 }}
								whileTap={{ scale: 0.98 }}
								data-testid={`stat-${key}`}
								className="rounded-btn border border-border bg-muted p-3 sm:p-4"
							>
								<span
									className={`flex size-8 items-center justify-center rounded-btn ${tint}`}
								>
									<Icon className="size-4" />
								</span>
								<p className="mt-3 font-stats font-bold text-2xl text-foreground">
									{statValues[key]}
								</p>
								<p className="text-muted-foreground text-xs leading-tight">
									{t(`home.stats.${key}`)}
								</p>
							</motion.div>
						))}
					</div>
				</motion.section>

				{engagement ? (
					<motion.div variants={itemMotion} className="space-y-4">
						<StreakPanel
							streak={engagement.streak}
							weekActivity={engagement.weekActivity}
						/>
						{/* §3.2 goal gradient — the next award is always in sight. */}
						<NextBadgeNudge nextBadge={engagement.nextBadge} />
					</motion.div>
				) : null}

				{/* Weekly AI Learning Coach digest (§4.10) — self-hides until one exists. */}
				<motion.div variants={itemMotion}>
					<CoachCard />
				</motion.div>

				<motion.section
					variants={itemMotion}
					className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]"
				>
					<motion.div
						whileHover={{ y: -2 }}
						className="rounded-card border border-border bg-card p-4 shadow-card sm:p-5"
					>
						<div className="flex items-center justify-between gap-3">
							<div>
								<p className="font-display text-lg text-foreground">
									{t("home.continue_title")}
								</p>
								<p className="mt-1 text-muted-foreground text-sm">
									{t("home.start_body")}
								</p>
							</div>
							<span className="flex size-10 shrink-0 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
								<PlayCircle className="size-5" />
							</span>
						</div>

						{inProgress.length > 0 ? (
							<div className="mt-4 space-y-3">
								<MyLearningCard item={inProgress[0]} />
								{inProgress.length > 1 ? (
									<Link
										to="/learn/mine"
										className="inline-flex items-center gap-1 font-semibold text-brand-primary text-sm hover:gap-1.5"
									>
										{t("my.view_all", { defaultValue: "View all" })}
										<ArrowRight className="size-4" />
									</Link>
								) : null}
							</div>
						) : (
							<div className="mt-4 rounded-btn border border-dashed border-border bg-muted p-4 text-center text-muted-foreground text-sm">
								{t("home.continue_empty")}
							</div>
						)}
					</motion.div>

					<motion.div
						whileHover={{ y: -2 }}
						className="rounded-card border border-brand-accent/25 bg-card p-4 shadow-card sm:p-5"
					>
						<div className="flex items-start gap-3">
							<span className="flex size-10 shrink-0 items-center justify-center rounded-btn bg-brand-accent-light text-brand-accent">
								<Lightbulb className="size-5" />
							</span>
							<div>
								<p className="font-display text-lg text-foreground">
									{t("home.tip_title")}
								</p>
								<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
									{t("home.tip_body")}
								</p>
							</div>
						</div>
					</motion.div>
				</motion.section>

				<motion.section
					variants={itemMotion}
					className="rounded-card border border-border bg-card p-4 shadow-card sm:p-5"
				>
					<div className="flex items-center justify-between gap-3">
						<div>
							<p className="font-stats font-semibold text-brand-primary text-xs uppercase">
								{t("home.learning_plan")}
							</p>
							<h3 className="mt-1 font-display text-xl text-foreground">
								{t("home.tips_title")}
							</h3>
						</div>
						<span className="hidden rounded-pill bg-brand-primary-light px-3 py-1 font-stats font-semibold text-brand-primary text-xs uppercase sm:inline-flex">
							{t("home.science_badge")}
						</span>
					</div>
					<div className="mt-4 grid gap-3 md:grid-cols-3">
						{LEARNING_TIPS.map(({ key, icon: Icon, tint }) => (
							<motion.article
								key={key}
								whileHover={{ y: -3 }}
								whileTap={{ scale: 0.99 }}
								className="rounded-btn border border-border bg-muted p-4"
							>
								<span
									className={`flex size-9 items-center justify-center rounded-btn ${tint}`}
								>
									<Icon className="size-4" />
								</span>
								<h4 className="mt-3 font-display text-foreground">
									{t(`home.learning_tips.${key}.title`)}
								</h4>
								<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
									{t(`home.learning_tips.${key}.body`)}
								</p>
							</motion.article>
						))}
					</div>
				</motion.section>

				<motion.section
					variants={itemMotion}
					id="explore"
					className="scroll-mt-20"
				>
					<div className="flex items-end justify-between gap-4">
						<div>
							<p className="font-stats font-semibold text-brand-primary text-xs uppercase">
								{t("home.recommended_title")}
							</p>
							<h3 className="mt-1 font-display text-xl text-foreground">
								{t("home.explore_title")}
							</h3>
						</div>
					</div>

					{coursesLoading ? (
						<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{["a", "b", "c"].map((k) => (
								<Skeleton key={k} className="h-48 rounded-card" />
							))}
						</div>
					) : courses && courses.length > 0 ? (
						<div className="mt-4">
							<Carousel
								items={courses}
								getKey={(c) => c.id}
								render={(course) => <PublicCourseCard course={course} />}
							/>
						</div>
					) : (
						<EmptyState className="mt-4" title={t("home.empty_courses")} />
					)}
				</motion.section>
			</motion.div>
		</LearnerShell>
	);
}
