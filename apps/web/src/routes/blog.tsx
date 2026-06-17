import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicShell } from "@/components/layout/public-shell";
import { Reveal } from "@/components/marketing/reveal";
import { SAMPLE_POSTS } from "@/lib/blog-data";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/blog")({ component: BlogPage });

function BlogPage() {
	const { t, i18n } = useTranslation("content");
	const locale = i18n.resolvedLanguage ?? "en";

	return (
		<PublicShell mobileTitle={t("blog.title")}>
			<div className="mx-auto max-w-7xl px-6 lg:px-8">
				<div className="pt-8 lg:pt-28">
					<h1 className="font-display text-3xl tracking-tight text-slate-900 sm:text-4xl">
						{t("blog.title")}
					</h1>
					<p className="mt-2 max-w-2xl text-lg text-slate-500">
						{t("blog.subtitle")}
					</p>
				</div>

				<Reveal className="mt-8 grid gap-6 pb-10 sm:grid-cols-2 lg:grid-cols-3">
					{SAMPLE_POSTS.map((post) => (
						<Link
							key={post.slug}
							to="/blog/$slug"
							params={{ slug: post.slug }}
							className="group flex flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover active:scale-[0.99]"
						>
							<div
								className={cn(
									"flex aspect-[16/9] items-end bg-gradient-to-br p-4",
									post.gradient,
								)}
							>
								<span className="rounded-pill bg-white/90 px-2.5 py-0.5 font-stats text-slate-700 text-xs">
									{post.category}
								</span>
							</div>
							<div className="flex flex-1 flex-col p-5">
								<h2 className="line-clamp-2 font-display text-lg text-slate-900 leading-snug">
									{post.title}
								</h2>
								<p className="mt-2 line-clamp-2 flex-1 text-slate-500 text-sm">
									{post.excerpt}
								</p>
								<p className="mt-4 text-slate-400 text-xs">
									{post.author} · {formatShortDate(post.date, locale)} ·{" "}
									{t("blog.read_time", { count: post.readMinutes })}
								</p>
							</div>
						</Link>
					))}
				</Reveal>
			</div>
		</PublicShell>
	);
}
