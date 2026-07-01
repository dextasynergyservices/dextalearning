import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Clock3, Loader2, Newspaper, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { StudioShell } from "@/components/authoring/studio-shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
	type BlogPostSummary,
	createBlogPost,
	deleteBlogPost,
	listBlogPosts,
} from "@/lib/content-api";

export const Route = createFileRoute("/admin/blog/")({
	component: BlogListPage,
});

function dateLabel(iso: string | null): string | null {
	if (!iso) return null;
	return new Date(iso).toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function BlogListPage() {
	const { t } = useTranslation("authoring");
	const queryClient = useQueryClient();
	const [title, setTitle] = useState("");
	const [creating, setCreating] = useState(false);
	const [toDelete, setToDelete] = useState<BlogPostSummary | null>(null);

	const { data: posts, isPending } = useQuery({
		queryKey: ["admin-blog"],
		queryFn: listBlogPosts,
	});

	const create = useMutation({
		mutationFn: () => createBlogPost({ title: title.trim() }),
		onSuccess: () => {
			setTitle("");
			setCreating(false);
			queryClient.invalidateQueries({ queryKey: ["admin-blog"] });
		},
		onError: (e) => toast.error(e.message),
	});

	const remove = useMutation({
		mutationFn: (id: string) => deleteBlogPost(id),
		onSuccess: () => {
			setToDelete(null);
			queryClient.invalidateQueries({ queryKey: ["admin-blog"] });
			toast.success(t("blog.deleted", { defaultValue: "Post deleted" }));
		},
		onError: (e) => toast.error(e.message),
	});

	const published = posts?.filter((p) => p.status === "published").length ?? 0;

	return (
		<StudioShell
			title={t("blog.title", { defaultValue: "Blog" })}
			area="admin"
			action={
				<Button size="sm" onClick={() => setCreating((v) => !v)}>
					<Plus className="size-4" />
					{t("blog.new", { defaultValue: "New post" })}
				</Button>
			}
		>
			<div className="space-y-5">
				<motion.section
					initial={{ opacity: 0, y: 14 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.34 }}
					className="rounded-card border border-brand-primary/15 bg-card p-4 shadow-card sm:p-6"
				>
					<p className="font-stats font-semibold text-brand-primary text-xs uppercase">
						{t("blog.eyebrow", { defaultValue: "Publish ideas" })}
					</p>
					<h2 className="mt-2 font-display text-2xl text-foreground sm:text-3xl">
						{t("blog.heading", { defaultValue: "Blog" })}
					</h2>
					<p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-relaxed">
						{t("blog.subtitle", {
							defaultValue:
								"Write articles that show up on the public blog — learning science, product news and more.",
						})}
					</p>
					<div className="mt-4 flex gap-6 text-sm">
						<span className="text-muted-foreground">
							<b className="font-stats font-bold text-foreground text-lg">
								{isPending ? "—" : (posts?.length ?? 0)}
							</b>{" "}
							{t("blog.stat_total", { defaultValue: "posts" })}
						</span>
						<span className="text-muted-foreground">
							<b className="font-stats font-bold text-foreground text-lg">
								{isPending ? "—" : published}
							</b>{" "}
							{t("courses.published")}
						</span>
					</div>
				</motion.section>

				{creating ? (
					<form
						onSubmit={(e) => {
							e.preventDefault();
							if (title.trim().length >= 3) create.mutate();
						}}
						className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center"
					>
						<input
							// biome-ignore lint/a11y/noAutofocus: focus the field the user just opened.
							autoFocus
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder={t("blog.field_title", {
								defaultValue: "Post title",
							})}
							className="h-11 flex-1 rounded-input border border-border px-3.5 text-foreground outline-none focus:border-brand-primary"
						/>
						<Button
							type="submit"
							disabled={title.trim().length < 3 || create.isPending}
						>
							{create.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Plus className="size-4" />
							)}
							{t("blog.create", { defaultValue: "Create post" })}
						</Button>
					</form>
				) : null}

				<div className="space-y-3">
					{isPending ? (
						["a", "b", "c"].map((k) => (
							<Skeleton key={k} className="h-20 rounded-card" />
						))
					) : posts && posts.length > 0 ? (
						posts.map((post) => (
							<motion.article
								key={post.id}
								whileHover={{ y: -2 }}
								className="flex items-center gap-3 rounded-card border border-border bg-card p-4 shadow-card transition-colors hover:border-brand-primary/30"
							>
								<Link
									to="/admin/blog/$postId"
									params={{ postId: post.id }}
									className="flex min-w-0 flex-1 items-center gap-3"
								>
									<span className="flex size-11 shrink-0 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
										<Newspaper className="size-5" />
									</span>
									<span className="min-w-0 flex-1">
										<span className="line-clamp-1 font-display text-foreground">
											{post.title}
										</span>
										<span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground text-xs">
											{post.category ? <span>{post.category}</span> : null}
											{post.readMinutes ? (
												<span className="flex items-center gap-1">
													<Clock3 className="size-3" />
													{t("blog.read_min", {
														defaultValue: "{{count}} min",
														count: post.readMinutes,
													})}
												</span>
											) : null}
											{dateLabel(post.publishedAt ?? post.createdAt) ? (
												<span>
													{dateLabel(post.publishedAt ?? post.createdAt)}
												</span>
											) : null}
										</span>
									</span>
								</Link>
								<span
									className={
										post.status === "published" ? "badge-open" : "badge-soon"
									}
								>
									{post.status === "published"
										? t("courses.published")
										: t("courses.draft")}
								</span>
								<button
									type="button"
									aria-label={t("editor.delete")}
									onClick={() => setToDelete(post)}
									className="flex size-8 items-center justify-center rounded-btn text-muted-foreground transition-colors hover:bg-error/5 hover:text-error"
								>
									<Trash2 className="size-4" />
								</button>
							</motion.article>
						))
					) : (
						<EmptyState
							icon={Newspaper}
							title={t("blog.empty", {
								defaultValue: "No posts yet — write your first article.",
							})}
						/>
					)}
				</div>
			</div>

			<ConfirmDialog
				open={Boolean(toDelete)}
				title={t("blog.delete_title", { defaultValue: "Delete post?" })}
				description={t("blog.delete_description", {
					defaultValue: "“{{title}}” will be removed.",
					title: toDelete?.title ?? "",
				})}
				confirmLabel={t("courses.delete_confirm", { defaultValue: "Delete" })}
				cancelLabel={t("courses.delete_cancel", { defaultValue: "Cancel" })}
				isPending={remove.isPending}
				tone="danger"
				onOpenChange={(o) => !o && setToDelete(null)}
				onConfirm={() => toDelete && remove.mutate(toDelete.id)}
			/>
		</StudioShell>
	);
}
