import { createFileRoute } from "@tanstack/react-router";
import { Award, Flame, GraduationCap } from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { CourseCard } from "@/components/catalog/course-card";
import { LearnerShell } from "@/components/layout/learner-shell";
import { Reveal } from "@/components/marketing/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth-client";
import { SAMPLE_COURSES } from "@/lib/sample-data";

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
		tint: "bg-orange-50 text-orange-500",
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
		tint: "bg-emerald-50 text-emerald-500",
	},
];

function firstNameOf(name?: string | null): string {
	return name?.trim()?.split(" ")[0] ?? "";
}

function DashboardPage() {
	const { t } = useTranslation("dashboard");
	const { data: session } = useSession();
	const firstName = firstNameOf(session?.user.name);
	const recommended = SAMPLE_COURSES.slice(0, 3);

	return (
		<LearnerShell title={t("home.greeting")}>
			<div className="pt-5 lg:pt-6">
				{/* Welcome banner */}
				<div className="relative overflow-hidden rounded-card bg-gradient-to-br from-brand-primary to-brand-primary-hover px-5 py-6 text-white shadow-card sm:px-7 sm:py-8">
					<div className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-white/10 blur-2xl" />
					<div className="pointer-events-none absolute -bottom-20 left-10 size-48 rounded-full bg-brand-accent/20 blur-3xl" />
					<h2 className="relative font-display text-2xl sm:text-3xl">
						{t("home.greeting")}
						{firstName ? `, ${firstName}` : ""} 👋
					</h2>
					<p className="relative mt-1 max-w-md text-sm text-blue-100 sm:text-base">
						{t("home.subtitle")}
					</p>
				</div>

				{/* Stats */}
				<Reveal className="mt-5 grid grid-cols-3 gap-3" y={20}>
					{STATS.map(({ key, icon: Icon, value, tint }) => (
						<div
							key={key}
							className="rounded-card border border-slate-200 bg-white p-4 text-center shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
						>
							<span
								className={`mx-auto flex size-9 items-center justify-center rounded-full ${tint}`}
							>
								<Icon className="size-5" />
							</span>
							<p className="mt-2 font-stats font-bold text-2xl text-slate-900">
								{value}
							</p>
							<p className="text-slate-500 text-xs">{t(`home.stats.${key}`)}</p>
						</div>
					))}
				</Reveal>

				{/* Continue learning */}
				<section className="mt-8">
					<h3 className="font-display text-lg text-slate-900">
						{t("home.continue_title")}
					</h3>
					<div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{["a", "b", "c"].map((key) => (
							<div
								key={key}
								className="overflow-hidden rounded-card border border-slate-200 bg-white shadow-card"
							>
								<Skeleton className="aspect-video rounded-none" />
								<div className="space-y-2 p-4">
									<Skeleton className="h-4 w-3/4" />
									<Skeleton className="h-3 w-1/2" />
									<Skeleton className="h-2 w-full" />
								</div>
							</div>
						))}
					</div>
					<p className="mt-3 text-slate-400 text-sm">
						{t("home.continue_empty")}
					</p>
				</section>

				{/* Recommended */}
				<section className="mt-8">
					<h3 className="font-display text-lg text-slate-900">
						{t("home.recommended_title")}
					</h3>
					<Reveal className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
						{recommended.map((course) => (
							<CourseCard key={course.slug} course={course} />
						))}
					</Reveal>
				</section>
			</div>
		</LearnerShell>
	);
}
