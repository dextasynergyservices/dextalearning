import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Award,
	BookOpen,
	Check,
	Clock,
	FileText,
	PlayCircle,
	Star,
	Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { PublicShell } from "@/components/layout/public-shell";
import { Reveal } from "@/components/marketing/reveal";
import { AccordionItem } from "@/components/ui/accordion-item";
import { buttonVariants } from "@/components/ui/button";
import { formatCompact, formatNgn } from "@/lib/format";
import { getCourseBySlug } from "@/lib/sample-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teachers/courses/$slug")({
	component: CourseDetailPage,
});

// Illustrative graduate testimonials (stand-in for API video testimonials).
const TESTIMONIALS = [
	{
		name: "Funke A.",
		role: "JSS teacher, Lagos",
		quote:
			"I used the recall techniques the very next Monday. My students were more engaged than I'd seen all term.",
	},
	{
		name: "Emeka O.",
		role: "Head of department",
		quote:
			"Practical, no fluff, and the 15-minute lessons fit around marking and lesson prep.",
	},
];

function CourseDetailPage() {
	const { slug } = Route.useParams();
	const { t } = useTranslation("academy");
	const course = getCourseBySlug(slug);

	if (!course) {
		return (
			<PublicShell mobileTitle={t("detail.not_found_title")} mobileShowBack>
				<section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-24 text-center">
					<h1 className="font-display text-2xl text-slate-900 sm:text-3xl">
						{t("detail.not_found_title")}
					</h1>
					<p className="mt-3 text-slate-500">{t("detail.not_found_body")}</p>
					<Link
						to="/teachers/courses"
						className={cn(
							buttonVariants({ variant: "outline", size: "md" }),
							"mt-6",
						)}
					>
						{t("catalog.title")}
					</Link>
				</section>
			</PublicShell>
		);
	}

	const isFree = course.priceNgn === 0;
	const priceLabel = isFree ? t("card.free") : formatNgn(course.priceNgn);
	const enrollLabel = isFree ? t("detail.enroll_free") : t("detail.enroll");

	const includes = [
		{
			icon: BookOpen,
			text: t("detail.includes_lessons", { count: course.lessonCount }),
		},
		{
			icon: Clock,
			text: t("detail.includes_hours", { hours: course.durationHours }),
		},
		{ icon: Award, text: t("detail.includes_certificate") },
		{ icon: FileText, text: t("detail.includes_transcript") },
	];

	return (
		<PublicShell mobileTitle={course.title} mobileShowBack>
			{/* Hero */}
			<section
				className={cn(
					"relative overflow-hidden bg-gradient-to-br text-white",
					course.gradient,
				)}
			>
				<div className="relative mx-auto max-w-7xl px-6 pt-20 pb-12 lg:px-8 lg:pt-32 lg:pb-16">
					<p className="font-stats text-sm font-semibold text-white/80 uppercase tracking-wide">
						{t(`categories.${course.category}`)}
					</p>
					<h1 className="mt-2 max-w-3xl font-display text-3xl leading-tight tracking-tight sm:text-4xl lg:text-5xl">
						{course.title}
					</h1>
					<p className="mt-4 max-w-2xl text-white/85">{course.summary}</p>
					<div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/90">
						<span className="inline-flex items-center gap-1">
							<Star className="size-4 fill-amber-300 text-amber-300" />
							<span className="font-semibold">{course.rating}</span>
						</span>
						<span className="inline-flex items-center gap-1">
							<Users className="size-4" /> {formatCompact(course.enrolled)}
						</span>
						<span className="inline-flex items-center gap-1">
							<Clock className="size-4" /> {course.durationHours}h
						</span>
						<span className="rounded-pill bg-white/15 px-2.5 py-0.5 font-stats text-xs">
							{t(`level.${course.level}`)}
						</span>
					</div>
					<p className="mt-4 text-sm text-white/80">
						{t("card.by", { name: course.instructorName })} ·{" "}
						{course.instructorTitle}
					</p>
				</div>
			</section>

			<div className="mx-auto max-w-7xl px-6 lg:grid lg:grid-cols-3 lg:gap-10 lg:px-8">
				{/* Main column */}
				<div className="pt-10 pb-32 lg:col-span-2 lg:pb-10">
					{/* Outcomes */}
					<h2 className="font-display text-2xl text-slate-900">
						{t("detail.outcomes_title")}
					</h2>
					<ul className="mt-4 grid gap-3 sm:grid-cols-2">
						{course.outcomes.map((outcome) => (
							<li key={outcome} className="flex items-start gap-2.5">
								<span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
									<Check className="size-3.5" />
								</span>
								<span className="text-sm text-slate-600">{outcome}</span>
							</li>
						))}
					</ul>

					{/* Includes — inline on mobile */}
					<div className="mt-8 rounded-card border border-slate-200 bg-slate-50 p-5 lg:hidden">
						<h3 className="font-display text-lg text-slate-900">
							{t("detail.includes_title")}
						</h3>
						<ul className="mt-3 space-y-2.5">
							{includes.map(({ icon: Icon, text }) => (
								<li
									key={text}
									className="flex items-center gap-3 text-sm text-slate-600"
								>
									<Icon className="size-4 text-brand-primary" /> {text}
								</li>
							))}
						</ul>
					</div>

					{/* Graduate (video) testimonials */}
					<h2 className="mt-12 font-display text-2xl text-slate-900">
						{t("detail.testimonials_title")}
					</h2>
					<Reveal className="mt-4 grid gap-4 sm:grid-cols-2">
						{TESTIMONIALS.map((item) => (
							<figure
								key={item.name}
								className="overflow-hidden rounded-card border border-slate-200 bg-white shadow-card"
							>
								<div className="flex aspect-video items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
									<PlayCircle className="size-10 text-white/80" />
								</div>
								<figcaption className="p-4">
									<blockquote className="text-sm text-slate-700">
										"{item.quote}"
									</blockquote>
									<p className="mt-3 font-semibold text-slate-900 text-sm">
										{item.name}
									</p>
									<p className="text-slate-500 text-xs">{item.role}</p>
								</figcaption>
							</figure>
						))}
					</Reveal>

					{/* Curriculum */}
					<h2 className="mt-12 font-display text-2xl text-slate-900">
						{t("detail.curriculum_title")}
					</h2>
					<div className="mt-4">
						{course.modules.map((module, index) => (
							<AccordionItem
								key={module.title}
								title={module.title}
								subtitle={t("card.lessons", { count: module.lessons.length })}
								defaultOpen={index === 0}
							>
								<ul className="space-y-2">
									{module.lessons.map((lesson) => (
										<li
											key={lesson.title}
											className="flex items-center gap-3 text-sm text-slate-600"
										>
											<PlayCircle className="size-4 shrink-0 text-slate-400" />
											<span className="flex-1">{lesson.title}</span>
											<span className="text-slate-400 text-xs">
												{t("detail.minutes", { count: lesson.minutes })}
											</span>
										</li>
									))}
								</ul>
							</AccordionItem>
						))}
					</div>

					{/* FAQ */}
					<h2 className="mt-12 font-display text-2xl text-slate-900">
						{t("detail.faq_title")}
					</h2>
					<div className="mt-4">
						{course.faqs.map((faq) => (
							<AccordionItem key={faq.q} title={faq.q}>
								<p className="text-sm leading-relaxed text-slate-600">
									{faq.a}
								</p>
							</AccordionItem>
						))}
					</div>

					{/* Instructor */}
					<h2 className="mt-12 font-display text-2xl text-slate-900">
						{t("detail.instructor_title")}
					</h2>
					<div className="mt-4 flex items-center gap-4 rounded-card border border-slate-200 bg-white p-5">
						<span className="flex size-14 items-center justify-center rounded-full bg-brand-primary-light font-display text-brand-primary text-xl">
							{course.instructorName.charAt(0)}
						</span>
						<div>
							<p className="font-display text-lg text-slate-900">
								{course.instructorName}
							</p>
							<p className="text-slate-500 text-sm">{course.instructorTitle}</p>
						</div>
					</div>
				</div>

				{/* Desktop sticky sidebar */}
				<aside className="hidden lg:block">
					<div className="sticky top-24 mt-10 rounded-card border border-slate-200 bg-white p-6 shadow-card">
						<p className="font-display text-3xl text-slate-900">{priceLabel}</p>
						{course.isEarnBack ? (
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
									className="flex items-center gap-3 text-sm text-slate-600"
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
				<div className="leading-tight">
					<p className="font-display text-lg text-slate-900">{priceLabel}</p>
				</div>
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
