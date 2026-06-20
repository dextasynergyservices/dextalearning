import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useScroll } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PublicShell } from "@/components/layout/public-shell";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicPost } from "@/lib/content-api";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/blog/$slug")({
	component: BlogPostPage,
});

// Typography for the admin-authored rich-text body.
const PROSE =
	"max-w-none text-[1.0625rem] text-slate-700 leading-[1.75] [&_a]:font-medium [&_a]:text-brand-primary [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:my-6 [&_blockquote]:border-brand-primary [&_blockquote]:border-l-4 [&_blockquote]:pl-5 [&_blockquote]:font-display [&_blockquote]:text-slate-800 [&_blockquote]:text-xl [&_blockquote]:italic [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-slate-900 [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-slate-900 [&_h3]:text-xl [&_hr]:my-8 [&_hr]:border-slate-200 [&_img]:my-6 [&_img]:rounded-card [&_li]:mt-1.5 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-5 [&_strong]:font-semibold [&_strong]:text-slate-900 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6";

function initialsOf(name?: string | null): string {
	if (!name) return "D";
	return (
		name
			.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? "")
			.join("") || "D"
	);
}

function BlogPostPage() {
	const { slug } = Route.useParams();
	const { t, i18n } = useTranslation(["content", "academy"]);
	const locale = i18n.resolvedLanguage ?? "en";
	const { scrollYProgress } = useScroll();
	const {
		data: post,
		isPending,
		isError,
	} = useQuery({
		queryKey: ["public-post", slug],
		queryFn: () => getPublicPost(slug),
	});

	if (isPending) {
		return (
			<PublicShell mobileTitle={t("blog.title")} mobileShowBack>
				<div className="mx-auto max-w-2xl space-y-4 px-5 py-10 lg:px-8 lg:py-16">
					<Skeleton className="h-5 w-24 rounded-pill" />
					<Skeleton className="h-10 w-full rounded-btn" />
					<Skeleton className="h-10 w-2/3 rounded-btn" />
					<Skeleton className="mt-2 h-64 w-full rounded-card" />
					<Skeleton className="h-40 w-full rounded-card" />
				</div>
			</PublicShell>
		);
	}

	if (isError || !post) {
		return (
			<PublicShell mobileTitle={t("blog.title")} mobileShowBack>
				<section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-24 text-center">
					<h1 className="font-display text-2xl text-slate-900 sm:text-3xl">
						{t("blog.not_found_title", { defaultValue: "Article not found" })}
					</h1>
					<p className="mt-3 text-slate-500">
						{t("blog.not_found_body", {
							defaultValue: "This article may have moved or been unpublished.",
						})}
					</p>
					<Link
						to="/blog"
						className={cn(
							buttonVariants({ variant: "outline", size: "md" }),
							"mt-6",
						)}
					>
						{t("blog.all_articles", { defaultValue: "All articles" })}
					</Link>
				</section>
			</PublicShell>
		);
	}

	const dateLabel = post.publishedAt
		? formatShortDate(post.publishedAt, locale)
		: null;
	const readLabel = post.readMinutes
		? t("blog.read_time", { count: post.readMinutes })
		: null;

	return (
		<PublicShell mobileTitle={post.title} mobileShowBack hideFooterOnMobile>
			{/* Reading progress */}
			<motion.div
				className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-brand-primary"
				style={{ scaleX: scrollYProgress }}
			/>

			<article className="mx-auto max-w-2xl px-5 pt-6 pb-24 lg:px-8 lg:pt-14 lg:pb-20">
				<Link
					to="/blog"
					className="inline-flex items-center gap-1.5 font-medium text-slate-500 text-sm transition-colors hover:text-brand-primary mt-8"
				>
					<ArrowLeft className="size-4" />
					{t("blog.all_articles", { defaultValue: "All articles" })}
				</Link>

				<header className="mt-5">
					{post.category ? (
						<span className="inline-flex rounded-pill bg-brand-primary-light px-3 py-1 font-stats font-semibold text-brand-primary text-xs uppercase tracking-wide">
							{post.category}
						</span>
					) : null}
					<h1 className="mt-3 font-display text-3xl text-slate-900 leading-[1.12] tracking-tight sm:text-4xl lg:text-[2.75rem]">
						{post.title}
					</h1>

					{/* Author byline */}
					<div className="mt-5 flex items-center gap-3">
						<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-primary font-display text-sm text-white">
							{initialsOf(post.authorName)}
						</span>
						<div className="min-w-0">
							<p className="font-medium text-slate-900 text-sm">
								{post.authorName ?? "DextaLearning"}
							</p>
							<div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-500 text-xs">
								{dateLabel ? (
									<span className="flex items-center gap-1">
										<CalendarDays className="size-3.5" />
										{dateLabel}
									</span>
								) : null}
								{readLabel ? (
									<span className="flex items-center gap-1">
										<Clock3 className="size-3.5" />
										{readLabel}
									</span>
								) : null}
							</div>
						</div>
					</div>
				</header>

				{post.coverUrl ? (
					<img
						src={post.coverUrl}
						alt=""
						className="mt-7 aspect-[16/9] w-full rounded-card object-cover shadow-card"
					/>
				) : null}

				{post.excerpt ? (
					<p className="mt-7 border-brand-primary/20 border-l-2 pl-4 font-display text-slate-600 text-lg leading-relaxed sm:text-xl">
						{post.excerpt}
					</p>
				) : null}

				{post.bodyHtml ? (
					<div
						className={cn("mt-7", PROSE)}
						// biome-ignore lint/security/noDangerouslySetInnerHtml: trusted admin-authored rich text.
						dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
					/>
				) : null}

				{/* Footer */}
				<footer className="mt-12 border-slate-200 border-t pt-8">
					{/* Author card */}
					<div className="flex items-center gap-4 rounded-card border border-slate-200 bg-slate-50 p-5">
						<span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-primary font-display text-white">
							{initialsOf(post.authorName)}
						</span>
						<div className="min-w-0">
							<p className="font-stats font-semibold text-slate-400 text-xs uppercase tracking-wide">
								{t("blog.written_by", { defaultValue: "Written by" })}
							</p>
							<p className="font-display text-lg text-slate-900">
								{post.authorName ?? "DextaLearning"}
							</p>
						</div>
					</div>

					<Link
						to="/blog"
						className="mt-6 inline-flex items-center gap-1.5 font-semibold text-brand-primary text-sm transition-all hover:gap-2.5"
					>
						<ArrowLeft className="size-4" />
						{t("blog.all_articles", { defaultValue: "All articles" })}
					</Link>

					<div className="mt-6 flex flex-col gap-4 overflow-hidden rounded-card bg-hero-bg p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-7">
						<div>
							<p className="font-display text-xl">
								{t("blog.cta_title", { defaultValue: "Put it into practice" })}
							</p>
							<p className="mt-1 text-slate-300 text-sm">
								{t("blog.cta_body", {
									defaultValue:
										"Explore courses built on the science of learning.",
								})}
							</p>
						</div>
						<Link
							to="/teachers/courses"
							className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-btn bg-brand-accent px-5 font-semibold text-sm text-white transition-colors hover:bg-brand-accent-hover"
						>
							{t("landing.browse_courses", {
								ns: "academy",
								defaultValue: "Browse courses",
							})}
							<ArrowRight className="size-4" />
						</Link>
					</div>
				</footer>
			</article>
		</PublicShell>
	);
}
