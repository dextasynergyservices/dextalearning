import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CatalogVisual } from "@/components/catalog/catalog-visual";
import { PublicShell } from "@/components/layout/public-shell";
import { Reveal } from "@/components/marketing/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublishedPosts } from "@/lib/content-api";
import { formatShortDate } from "@/lib/format";

export const Route = createFileRoute("/blog/")({ component: BlogPage });

function BlogPage() {
	const { t, i18n } = useTranslation("content");
	const locale = i18n.resolvedLanguage ?? "en";
	const { data: posts, isPending } = useQuery({
		queryKey: ["published-posts"],
		queryFn: getPublishedPosts,
		staleTime: 0,
		refetchOnMount: "always",
	});

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

				{isPending ? (
					<div className="mt-8 grid gap-6 pb-10 sm:grid-cols-2 lg:grid-cols-3">
						{["a", "b", "c"].map((k) => (
							<Skeleton key={k} className="h-72 rounded-card" />
						))}
					</div>
				) : posts && posts.length > 0 ? (
					<Reveal className="mt-8 grid gap-6 pb-10 sm:grid-cols-2 lg:grid-cols-3">
						{posts.map((post) => (
							<Link
								key={post.id}
								to="/blog/$slug"
								params={{ slug: post.slug }}
								className="group flex flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover active:scale-[0.99]"
							>
								<div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
									{post.coverUrl ? (
										<img
											src={post.coverUrl}
											alt=""
											className="size-full object-cover transition-transform group-hover:scale-[1.03]"
										/>
									) : (
										<CatalogVisual
											icon={FileText}
											label={post.category ?? undefined}
											meta={
												post.readMinutes
													? t("blog.read_time", { count: post.readMinutes })
													: undefined
											}
											tone="accent"
											className="size-full"
										/>
									)}
								</div>
								<div className="flex flex-1 flex-col p-5">
									{post.category ? (
										<span className="font-stats font-semibold text-brand-primary text-xs uppercase">
											{post.category}
										</span>
									) : null}
									<h2 className="mt-1 line-clamp-2 font-display text-lg text-slate-900 leading-snug">
										{post.title}
									</h2>
									{post.excerpt ? (
										<p className="mt-2 line-clamp-2 flex-1 text-slate-500 text-sm">
											{post.excerpt}
										</p>
									) : null}
									<p className="mt-4 text-slate-400 text-xs">
										{[
											post.authorName,
											post.publishedAt
												? formatShortDate(post.publishedAt, locale)
												: null,
											post.readMinutes
												? t("blog.read_time", { count: post.readMinutes })
												: null,
										]
											.filter(Boolean)
											.join(" · ")}
									</p>
								</div>
							</Link>
						))}
					</Reveal>
				) : (
					<div className="mt-8 rounded-card border border-slate-200 border-dashed bg-white py-20 text-center">
						<FileText className="mx-auto size-8 text-slate-300" />
						<p className="mt-3 text-slate-500">
							{t("blog.empty", {
								defaultValue: "No articles yet — check back soon.",
							})}
						</p>
					</div>
				)}
			</div>
		</PublicShell>
	);
}
