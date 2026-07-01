import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CatalogVisual } from "@/components/catalog/catalog-visual";
import { PublicShell } from "@/components/layout/public-shell";
import { Reveal } from "@/components/marketing/reveal";
import { EmptyState } from "@/components/ui/empty-state";
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
		<PublicShell darkHeader>
			{/* Hero — matches About/Community, the other "More" nav pages */}
			<section className="relative overflow-hidden bg-hero-bg text-white">
				<div className="relative mx-auto max-w-4xl px-6 pt-24 pb-14 text-center lg:pt-32 lg:pb-20">
					<motion.span
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5 }}
						className="badge-earnback mb-5 bg-white/10 text-brand-accent"
					>
						{t("blog.badge", { defaultValue: "Blog" })}
					</motion.span>
					<motion.h1
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.05 }}
						className="font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl"
					>
						{t("blog.title")}
					</motion.h1>
					<motion.p
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.15 }}
						className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground"
					>
						{t("blog.subtitle")}
					</motion.p>
				</div>
			</section>

			<div className="mx-auto max-w-7xl px-6 lg:px-8">
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
								className="group flex flex-col overflow-hidden rounded-card border border-border bg-card shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover active:scale-[0.99]"
							>
								<div className="relative aspect-[16/9] overflow-hidden bg-muted">
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
									<h2 className="mt-1 line-clamp-2 font-display text-lg text-foreground leading-snug">
										{post.title}
									</h2>
									{post.excerpt ? (
										<p className="mt-2 line-clamp-2 flex-1 text-muted-foreground text-sm">
											{post.excerpt}
										</p>
									) : null}
									<p className="mt-4 text-muted-foreground text-xs">
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
					<EmptyState
						className="mt-8"
						icon={FileText}
						title={t("blog.empty", {
							defaultValue: "No articles yet — check back soon.",
						})}
					/>
				)}
			</div>
		</PublicShell>
	);
}
