import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PublicShell } from "@/components/layout/public-shell";
import { Reveal } from "@/components/marketing/reveal";
import { buttonVariants } from "@/components/ui/button";
import { getPostBySlug } from "@/lib/blog-data";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/blog/$slug")({
	component: BlogPostPage,
});

function BlogPostPage() {
	const { slug } = Route.useParams();
	const { t, i18n } = useTranslation("content");
	const post = getPostBySlug(slug);

	if (!post) {
		return (
			<PublicShell mobileTitle={t("blog.not_found_title")} mobileShowBack>
				<section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-24 text-center">
					<h1 className="font-display text-2xl text-slate-900 sm:text-3xl">
						{t("blog.not_found_title")}
					</h1>
					<p className="mt-3 text-slate-500">{t("blog.not_found_body")}</p>
					<Link
						to="/blog"
						className={cn(
							buttonVariants({ variant: "outline", size: "md" }),
							"mt-6",
						)}
					>
						{t("blog.back")}
					</Link>
				</section>
			</PublicShell>
		);
	}

	const locale = i18n.resolvedLanguage ?? "en";

	return (
		<PublicShell mobileTitle={post.title} mobileShowBack>
			<section
				className={cn(
					"relative overflow-hidden bg-gradient-to-br text-white",
					post.gradient,
				)}
			>
				<div className="relative mx-auto max-w-3xl px-6 pt-20 pb-12 lg:pt-32 lg:pb-16">
					<span className="rounded-pill bg-white/15 px-2.5 py-0.5 font-stats text-white text-xs">
						{post.category}
					</span>
					<h1 className="mt-3 font-display text-3xl leading-tight tracking-tight sm:text-4xl lg:text-5xl">
						{post.title}
					</h1>
					<p className="mt-4 text-sm text-white/80">
						{post.author} · {formatShortDate(post.date, locale)} ·{" "}
						{t("blog.read_time", { count: post.readMinutes })}
					</p>
				</div>
			</section>

			<article className="mx-auto max-w-3xl px-6 pt-10 pb-20">
				<Reveal
					className="space-y-5 text-base text-slate-700 leading-relaxed"
					y={20}
					stagger={0.06}
				>
					{post.body.map((paragraph) => (
						<p key={paragraph.slice(0, 32)}>{paragraph}</p>
					))}
				</Reveal>
				<Link
					to="/blog"
					className={cn(
						buttonVariants({ variant: "ghost", size: "sm" }),
						"mt-10 text-brand-primary",
					)}
				>
					<ArrowLeft className="size-4" /> {t("blog.back")}
				</Link>
			</article>
		</PublicShell>
	);
}
