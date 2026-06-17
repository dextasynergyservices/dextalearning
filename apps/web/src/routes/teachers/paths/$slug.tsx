import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Award,
	BookOpen,
	ChevronRight,
	Clock,
	FileText,
	Target,
	Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { PublicShell } from "@/components/layout/public-shell";
import { buttonVariants } from "@/components/ui/button";
import { formatCompact, formatNgn } from "@/lib/format";
import { getCourseBySlug, getPathBySlug } from "@/lib/sample-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teachers/paths/$slug")({
	component: PathDetailPage,
});

function PathDetailPage() {
	const { slug } = Route.useParams();
	const { t } = useTranslation("academy");
	const path = getPathBySlug(slug);

	if (!path) {
		return (
			<PublicShell mobileTitle={t("paths.not_found_title")} mobileShowBack>
				<section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-24 text-center">
					<h1 className="font-display text-2xl text-slate-900 sm:text-3xl">
						{t("paths.not_found_title")}
					</h1>
					<p className="mt-3 text-slate-500">{t("paths.not_found_body")}</p>
					<Link
						to="/teachers/paths"
						className={cn(
							buttonVariants({ variant: "outline", size: "md" }),
							"mt-6",
						)}
					>
						{t("paths.title")}
					</Link>
				</section>
			</PublicShell>
		);
	}

	const isFree = path.priceNgn === 0;
	const priceLabel = isFree ? t("card.free") : formatNgn(path.priceNgn);
	const enrollLabel = isFree ? t("detail.enroll_free") : t("detail.enroll");
	const courses = path.courseSlugs
		.map((courseSlug) => getCourseBySlug(courseSlug))
		.filter((course) => course !== undefined);

	const includes = [
		{
			icon: BookOpen,
			text: t("paths.courses_count", { count: courses.length }),
		},
		{
			icon: Clock,
			text: t("detail.includes_hours", { hours: path.estimatedHours }),
		},
		{ icon: Award, text: t("detail.includes_certificate") },
		{ icon: FileText, text: t("detail.includes_transcript") },
	];

	return (
		<PublicShell mobileTitle={path.title} mobileShowBack>
			<section
				className={cn(
					"relative overflow-hidden bg-gradient-to-br text-white",
					path.gradient,
				)}
			>
				<div className="relative mx-auto max-w-7xl px-6 pt-20 pb-12 lg:px-8 lg:pt-32 lg:pb-16">
					<p className="font-stats font-semibold text-white/80 text-sm uppercase tracking-wide">
						{t("paths.title")}
					</p>
					<h1 className="mt-2 max-w-3xl font-display text-3xl leading-tight tracking-tight sm:text-4xl lg:text-5xl">
						{path.title}
					</h1>
					<p className="mt-4 max-w-2xl text-white/85">{path.summary}</p>
					<div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/90">
						<span className="inline-flex items-center gap-1">
							<BookOpen className="size-4" />{" "}
							{t("paths.courses_count", { count: courses.length })}
						</span>
						<span className="inline-flex items-center gap-1">
							<Clock className="size-4" /> {path.estimatedHours}h
						</span>
						<span className="inline-flex items-center gap-1">
							<Users className="size-4" /> {formatCompact(path.enrolled)}
						</span>
						<span className="rounded-pill bg-white/15 px-2.5 py-0.5 font-stats text-xs">
							{t(`level.${path.level}`)}
						</span>
					</div>
				</div>
			</section>

			<div className="mx-auto max-w-7xl px-6 lg:grid lg:grid-cols-3 lg:gap-10 lg:px-8">
				<div className="pt-10 pb-32 lg:col-span-2 lg:pb-10">
					{/* Outcome */}
					<div className="flex items-start gap-3 rounded-card border border-brand-primary/15 bg-brand-primary-light/40 p-5">
						<Target className="mt-0.5 size-5 shrink-0 text-brand-primary" />
						<div>
							<h2 className="font-display text-lg text-slate-900">
								{t("paths.outcome_title")}
							</h2>
							<p className="mt-1 text-slate-600 text-sm">{path.outcome}</p>
						</div>
					</div>

					{/* Courses in this path */}
					<h2 className="mt-10 font-display text-2xl text-slate-900">
						{t("paths.includes_courses")}
					</h2>
					<ol className="mt-4 space-y-3">
						{courses.map((course, index) => (
							<li key={course.slug}>
								<Link
									to="/teachers/courses/$slug"
									params={{ slug: course.slug }}
									className="group flex items-center gap-4 rounded-card border border-slate-200 bg-white p-4 transition-colors hover:border-brand-primary/30"
								>
									<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-primary-light font-stats font-semibold text-brand-primary text-sm">
										{index + 1}
									</span>
									<div className="min-w-0 flex-1">
										<p className="truncate font-medium text-slate-900">
											{course.title}
										</p>
										<p className="text-slate-500 text-xs">
											{t("card.lessons", { count: course.lessonCount })} ·{" "}
											{course.durationHours}h
										</p>
									</div>
									<ChevronRight className="size-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-primary" />
								</Link>
							</li>
						))}
					</ol>
				</div>

				{/* Desktop sticky sidebar */}
				<aside className="hidden lg:block">
					<div className="sticky top-24 mt-10 rounded-card border border-slate-200 bg-white p-6 shadow-card">
						<p className="font-display text-3xl text-slate-900">{priceLabel}</p>
						{path.isEarnBack ? (
							<span className="badge-earnback mt-2">{t("card.earn_back")}</span>
						) : null}
						<Link
							to="/register"
							className={cn(
								buttonVariants({ variant: "primary", size: "lg" }),
								"mt-4 w-full",
							)}
						>
							{enrollLabel}
						</Link>
						<h3 className="mt-6 font-display text-slate-900">
							{t("detail.includes_title")}
						</h3>
						<ul className="mt-3 space-y-2.5">
							{includes.map(({ icon: Icon, text }) => (
								<li
									key={text}
									className="flex items-center gap-3 text-slate-600 text-sm"
								>
									<Icon className="size-4 text-brand-primary" /> {text}
								</li>
							))}
						</ul>
					</div>
				</aside>
			</div>

			{/* Native sticky enroll bar (mobile) */}
			<div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 border-slate-200 border-t bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden">
				<p className="font-display text-lg text-slate-900">{priceLabel}</p>
				<Link
					to="/register"
					className={cn(
						buttonVariants({ variant: "primary", size: "md" }),
						"ml-auto flex-1",
					)}
				>
					{enrollLabel}
				</Link>
			</div>
		</PublicShell>
	);
}
