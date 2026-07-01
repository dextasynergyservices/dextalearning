import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
	ArrowRight,
	BookOpen,
	GraduationCap,
	Users,
	Waypoints,
} from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { PublicCourseCard } from "@/components/catalog/public-cards";
import { PublicShell } from "@/components/layout/public-shell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useReveal } from "@/hooks/use-reveal";
import { getPublishedCourses } from "@/lib/content-api";

export const Route = createFileRoute("/teachers/")({
	component: TeacherAcademyPage,
});

const PILLARS: {
	key: "courses" | "paths" | "cohorts";
	to: string;
	icon: ComponentType<{ className?: string }>;
}[] = [
	{ key: "courses", to: "/teachers/courses", icon: BookOpen },
	{ key: "paths", to: "/teachers/paths", icon: Waypoints },
	{ key: "cohorts", to: "/teachers/cohorts", icon: Users },
];

function TeacherAcademyPage() {
	const { t } = useTranslation("academy");
	const { data: courses, isPending } = useQuery({
		queryKey: ["published-courses"],
		queryFn: getPublishedCourses,
	});
	const featured = (courses ?? []).slice(0, 4);
	const pillarsRef = useReveal<HTMLElement>();
	const featuredRef = useReveal<HTMLElement>();

	return (
		<PublicShell darkHeader>
			{/* Hero */}
			<section className="relative overflow-hidden bg-hero-bg text-white">
				<div className="relative mx-auto max-w-4xl px-6 pt-24 pb-16 text-center lg:pt-36 lg:pb-24">
					<motion.span
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5 }}
						className="badge-earnback mb-6 bg-white/10 text-brand-accent"
					>
						<GraduationCap className="mr-1.5 size-3.5" /> {t("landing.badge")}
					</motion.span>
					<motion.h1
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.05 }}
						className="font-display text-3xl leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
					>
						{t("landing.title")}
					</motion.h1>
					<motion.p
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.15 }}
						className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg"
					>
						{t("landing.subtitle")}
					</motion.p>
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.25 }}
						className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
					>
						<Link
							to="/teachers/courses"
							className={buttonVariants({ variant: "accent", size: "lg" })}
						>
							{t("landing.browse_courses")} <ArrowRight className="size-4" />
						</Link>
						<Link
							to="/teachers/paths"
							className={buttonVariants({ variant: "white", size: "lg" })}
						>
							{t("landing.view_paths")}
						</Link>
					</motion.div>
				</div>
			</section>

			{/* Three ways to grow */}
			<section
				ref={pillarsRef}
				className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-20"
			>
				<h2
					data-reveal
					className="text-center font-display text-2xl tracking-tight text-foreground sm:text-3xl"
				>
					{t("landing.explore_title")}
				</h2>
				<div className="mt-10 grid gap-4 sm:grid-cols-3">
					{PILLARS.map(({ key, to, icon: Icon }, idx) => (
						<Link
							key={key}
							to={to}
							data-reveal={idx % 2 === 0 ? "left" : "right"}
							className="group rounded-card border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:border-brand-primary/30 hover:shadow-card-hover active:scale-[0.99]"
						>
							<span className="flex size-12 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary transition-colors group-hover:bg-brand-primary group-hover:text-white">
								<Icon className="size-6" />
							</span>
							<h3 className="mt-4 font-display text-lg text-foreground">
								{t(`landing.${key}_name`)}
							</h3>
							<p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
								{t(`landing.${key}_desc`)}
							</p>
							<span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-primary group-hover:gap-2">
								{t("landing.view_all")} <ArrowRight className="size-4" />
							</span>
						</Link>
					))}
				</div>
			</section>

			{/* Featured courses */}
			<section ref={featuredRef} className="bg-muted">
				<div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-20">
					<div className="flex items-center justify-between">
						<h2
							data-reveal
							className="font-display text-2xl tracking-tight text-foreground sm:text-3xl"
						>
							{t("landing.featured")}
						</h2>
						<Link
							to="/teachers/courses"
							data-reveal
							className="inline-flex items-center gap-1 text-sm font-semibold text-brand-primary hover:gap-2"
						>
							{t("landing.view_all")} <ArrowRight className="size-4" />
						</Link>
					</div>
					{isPending ? (
						<div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
							{["a", "b", "c", "d"].map((k) => (
								<Skeleton key={k} className="h-64 rounded-card" />
							))}
						</div>
					) : featured.length > 0 ? (
						<div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
							{featured.map((course) => (
								<div key={course.id} data-reveal="scale">
									<PublicCourseCard course={course} />
								</div>
							))}
						</div>
					) : (
						<EmptyState
							className="mt-8"
							icon={BookOpen}
							title={t("landing.featured_empty", {
								defaultValue: "New courses are on the way — check back soon.",
							})}
						/>
					)}
				</div>
			</section>
		</PublicShell>
	);
}
