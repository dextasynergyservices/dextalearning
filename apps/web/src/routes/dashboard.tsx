import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
	ArrowRight,
	Award,
	BookOpen,
	Brain,
	Clock3,
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
import { LearnerShell } from "@/components/layout/learner-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth-client";
import { getPublishedCourses } from "@/lib/content-api";

export const Route = createFileRoute("/dashboard")({
	component: DashboardPage,
});

const STATS: {
	key: string;
	icon: ComponentType<{ className?: string }>;
	value: string;
	tint: string;
}[] = [
	{
		key: "streak",
		icon: Flame,
		value: "0",
		tint: "bg-brand-accent-light text-brand-accent",
	},
	{
		key: "courses",
		icon: GraduationCap,
		value: "0",
		tint: "bg-brand-primary-light text-brand-primary",
	},
	{
		key: "certificates",
		icon: Award,
		value: "0",
		tint: "bg-slate-100 text-slate-700",
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
		tint: "bg-slate-100 text-slate-700",
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
		queryFn: getPublishedCourses,
		staleTime: 0,
		refetchOnMount: "always",
	});

	const featuredCourse = courses?.[0];

	return (
		<LearnerShell title={t("home.greeting")}>
			<motion.div
				variants={containerMotion}
				initial="hidden"
				animate="show"
				className="space-y-6 pt-4 lg:space-y-8 lg:pt-7"
			>
				<motion.section
					variants={itemMotion}
					className="rounded-card border border-brand-primary/15 bg-white p-4 shadow-card sm:p-6"
				>
					<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
						<div className="min-w-0">
							<p className="font-stats font-semibold text-brand-primary text-xs uppercase">
								{t("home.greeting")}
							</p>
							<h2 className="mt-2 font-display text-2xl leading-tight text-slate-900 sm:text-3xl">
								{firstName ? `${firstName}, ` : ""}
								{t("home.subtitle")}
							</h2>
							<p className="mt-2 max-w-xl text-slate-600 text-sm leading-relaxed">
								{t("home.tip_body")}
							</p>
						</div>
						<a
							href="#explore"
							className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-btn bg-brand-primary px-5 font-semibold text-sm text-white transition-colors hover:bg-brand-primary-hover active:scale-[0.98]"
						>
							<Compass className="size-4" />
							{t("home.browse_cta")}
						</a>
					</div>

					<div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
						{STATS.map(({ key, icon: Icon, value, tint }) => (
							<motion.div
								key={key}
								whileHover={{ y: -2 }}
								whileTap={{ scale: 0.98 }}
								className="rounded-btn border border-slate-200 bg-slate-50 p-3 sm:p-4"
							>
								<span
									className={`flex size-8 items-center justify-center rounded-btn ${tint}`}
								>
									<Icon className="size-4" />
								</span>
								<p className="mt-3 font-stats font-bold text-2xl text-slate-900">
									{value}
								</p>
								<p className="text-slate-500 text-xs leading-tight">
									{t(`home.stats.${key}`)}
								</p>
							</motion.div>
						))}
					</div>
				</motion.section>

				<motion.section
					variants={itemMotion}
					className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]"
				>
					<motion.div
						whileHover={{ y: -2 }}
						className="rounded-card border border-slate-200 bg-white p-4 shadow-card sm:p-5"
					>
						<div className="flex items-center justify-between gap-3">
							<div>
								<p className="font-display text-lg text-slate-900">
									{t("home.continue_title")}
								</p>
								<p className="mt-1 text-slate-500 text-sm">
									{t("home.start_body")}
								</p>
							</div>
							<span className="flex size-10 shrink-0 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
								<PlayCircle className="size-5" />
							</span>
						</div>

						{featuredCourse ? (
							<Link
								to="/courses/$slug"
								params={{ slug: featuredCourse.slug }}
								className="mt-4 flex items-center gap-3 rounded-btn border border-brand-primary/20 bg-brand-primary-light/60 p-3 transition-colors hover:border-brand-primary/40"
							>
								<span className="flex size-11 shrink-0 items-center justify-center rounded-btn bg-white text-brand-primary">
									<BookOpen className="size-5" />
								</span>
								<span className="min-w-0 flex-1">
									<span className="line-clamp-1 font-semibold text-slate-900 text-sm">
										{featuredCourse.title}
									</span>
									<span className="mt-0.5 flex items-center gap-1.5 text-slate-500 text-xs">
										<Clock3 className="size-3.5" />
										{t("home.view_course")}
									</span>
								</span>
								<ArrowRight className="size-4 text-brand-primary" />
							</Link>
						) : (
							<div className="mt-4 rounded-btn border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-slate-500 text-sm">
								{t("home.continue_empty")}
							</div>
						)}
					</motion.div>

					<motion.div
						whileHover={{ y: -2 }}
						className="rounded-card border border-brand-accent/25 bg-white p-4 shadow-card sm:p-5"
					>
						<div className="flex items-start gap-3">
							<span className="flex size-10 shrink-0 items-center justify-center rounded-btn bg-brand-accent-light text-brand-accent">
								<Lightbulb className="size-5" />
							</span>
							<div>
								<p className="font-display text-lg text-slate-900">
									{t("home.tip_title")}
								</p>
								<p className="mt-1 text-slate-600 text-sm leading-relaxed">
									{t("home.tip_body")}
								</p>
							</div>
						</div>
					</motion.div>
				</motion.section>

				<motion.section
					variants={itemMotion}
					className="rounded-card border border-slate-200 bg-white p-4 shadow-card sm:p-5"
				>
					<div className="flex items-center justify-between gap-3">
						<div>
							<p className="font-stats font-semibold text-brand-primary text-xs uppercase">
								{t("home.learning_plan")}
							</p>
							<h3 className="mt-1 font-display text-xl text-slate-900">
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
								className="rounded-btn border border-slate-200 bg-slate-50 p-4"
							>
								<span
									className={`flex size-9 items-center justify-center rounded-btn ${tint}`}
								>
									<Icon className="size-4" />
								</span>
								<h4 className="mt-3 font-display text-slate-900">
									{t(`home.learning_tips.${key}.title`)}
								</h4>
								<p className="mt-1 text-slate-600 text-sm leading-relaxed">
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
							<h3 className="mt-1 font-display text-xl text-slate-900">
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
						<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{courses.map((course, i) => (
								<motion.div
									key={course.id}
									whileHover={{ y: -4 }}
									whileTap={{ scale: 0.99 }}
								>
									<Link
										to="/courses/$slug"
										params={{ slug: course.slug }}
										className="group flex min-h-48 flex-col rounded-card border border-slate-200 bg-white p-4 shadow-card transition-colors hover:border-brand-primary/30 hover:shadow-card-hover"
									>
										<div className="flex items-start justify-between gap-3">
											<span className="flex size-11 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
												<BookOpen className="size-5" />
											</span>
											<span className="rounded-pill bg-slate-100 px-2.5 py-1 font-stats font-semibold text-[0.65rem] text-slate-600 uppercase">
												{course.level ?? course.language}
											</span>
										</div>
										<h4 className="mt-4 line-clamp-2 font-display text-lg leading-snug text-slate-900">
											{course.title}
										</h4>
										{course.description ? (
											<p className="mt-2 line-clamp-2 text-slate-500 text-sm leading-relaxed">
												{course.description}
											</p>
										) : null}
										<div className="mt-auto flex items-center justify-between pt-4">
											<span className="font-stats text-slate-400 text-xs">
												{t("courses.modules", {
													ns: "authoring",
													count: course._count.modules,
												})}
											</span>
											<span className="flex items-center gap-1 font-semibold text-brand-primary text-sm transition-all group-hover:gap-1.5">
												{t("home.view_course")}
												<ArrowRight className="size-4" />
											</span>
										</div>
										<div
											className="mt-4 h-1 rounded-full bg-brand-primary-light"
											aria-hidden="true"
										>
											<motion.div
												initial={{ width: 0 }}
												animate={{ width: `${Math.min(100, 30 + i * 10)}%` }}
												transition={{ duration: 0.7, delay: 0.1 + i * 0.04 }}
												className="h-full rounded-full bg-brand-primary"
											/>
										</div>
									</Link>
								</motion.div>
							))}
						</div>
					) : (
						<div className="mt-4 rounded-card border border-slate-200 border-dashed bg-white py-12 text-center text-slate-500 text-sm">
							{t("home.empty_courses")}
						</div>
					)}
				</motion.section>
			</motion.div>
		</LearnerShell>
	);
}
