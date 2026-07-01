import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ImagePlus, Loader2, Rocket, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/authoring/rich-text-editor";
import { StudioShell } from "@/components/authoring/studio-shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
	deleteBlogPost,
	getBlogPost,
	publishBlogPost,
	updateBlogPost,
	uploadBlogCover,
} from "@/lib/content-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/blog/$postId")({
	component: BlogEditorPage,
});

function BlogEditorPage() {
	const { postId } = Route.useParams();
	const { t } = useTranslation("authoring");
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const fileRef = useRef<HTMLInputElement>(null);
	const [deleteOpen, setDeleteOpen] = useState(false);

	const { data: post, isPending } = useQuery({
		queryKey: ["blog-post", postId],
		queryFn: () => getBlogPost(postId),
	});

	const [title, setTitle] = useState("");
	const [category, setCategory] = useState("");
	const [excerpt, setExcerpt] = useState("");
	const [authorName, setAuthorName] = useState("");
	const [body, setBody] = useState("");
	const [coverUrl, setCoverUrl] = useState<string | null>(null);

	// Hydrate local form once the post loads.
	useEffect(() => {
		if (!post) return;
		setTitle(post.title);
		setCategory(post.category ?? "");
		setExcerpt(post.excerpt ?? "");
		setAuthorName(post.authorName ?? "");
		setBody(post.bodyHtml ?? "");
		setCoverUrl(post.coverUrl);
	}, [post]);

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["blog-post", postId] });

	const save = useMutation({
		mutationFn: () =>
			updateBlogPost(postId, {
				title: title.trim() || undefined,
				category: category.trim() || undefined,
				excerpt: excerpt.trim() || undefined,
				authorName: authorName.trim() || undefined,
				bodyHtml: body,
			}),
		onSuccess: () => {
			invalidate();
			queryClient.invalidateQueries({ queryKey: ["admin-blog"] });
			toast.success(t("settings.saved", { defaultValue: "Saved" }));
		},
		onError: (e) => toast.error(e.message),
	});

	const upload = useMutation({
		mutationFn: (file: File) => uploadBlogCover(postId, file),
		onSuccess: (res) => {
			setCoverUrl(res.coverUrl);
			invalidate();
			toast.success(t("blog.cover_saved", { defaultValue: "Cover updated" }));
		},
		onError: (e) => toast.error(e.message),
	});

	const publish = useMutation({
		mutationFn: () => publishBlogPost(postId),
		onSuccess: () => {
			invalidate();
			queryClient.invalidateQueries({ queryKey: ["admin-blog"] });
			toast.success(t("blog.published", { defaultValue: "Post published" }));
		},
		onError: (e) => toast.error(e.message),
	});

	const removePost = useMutation({
		mutationFn: () => deleteBlogPost(postId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["admin-blog"] });
			toast.success(t("blog.deleted", { defaultValue: "Post deleted" }));
			navigate({ to: "/admin/blog" });
		},
		onError: (e) => toast.error(e.message),
	});

	return (
		<StudioShell
			title={post?.title ?? "…"}
			area="admin"
			action={
				<div className="flex flex-wrap items-center justify-end gap-2">
					<span
						className={
							post?.status === "published" ? "badge-open" : "badge-soon"
						}
					>
						{post?.status === "published"
							? t("courses.published")
							: t("courses.draft")}
					</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setDeleteOpen(true)}
						className="text-error hover:bg-error/5"
					>
						<Trash2 className="size-4" />
						{t("editor.delete")}
					</Button>
					<Button
						size="sm"
						onClick={() => publish.mutate()}
						disabled={publish.isPending}
					>
						{publish.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Rocket className="size-4" />
						)}
						{t("blog.publish", { defaultValue: "Publish post" })}
					</Button>
				</div>
			}
		>
			{isPending || !post ? (
				<div className="space-y-4">
					<Skeleton className="h-40 rounded-card" />
					<Skeleton className="h-64 rounded-card" />
				</div>
			) : (
				<div className="space-y-6">
					<section className="rounded-card border border-border bg-card p-4 shadow-card sm:p-6">
						<div className="grid gap-5 lg:grid-cols-[280px_1fr]">
							{/* Cover */}
							<div>
								<p className="mb-2 font-medium text-foreground text-sm">
									{t("blog.cover", { defaultValue: "Cover image" })}
								</p>
								<button
									type="button"
									onClick={() => fileRef.current?.click()}
									className={cn(
										"group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-card border-2 border-border border-dashed bg-muted transition-colors hover:border-brand-primary/50",
										coverUrl && "border-solid",
									)}
								>
									{coverUrl ? (
										<img
											src={coverUrl}
											alt=""
											className="size-full object-cover"
										/>
									) : (
										<span className="flex flex-col items-center gap-1 text-muted-foreground">
											<ImagePlus className="size-6" />
											<span className="text-xs">
												{t("settings.thumb_hint", {
													defaultValue: "PNG, JPG or WebP · ≤5MB",
												})}
											</span>
										</span>
									)}
									{upload.isPending ? (
										<span className="absolute inset-0 flex items-center justify-center bg-white/70">
											<Loader2 className="size-6 animate-spin text-brand-primary" />
										</span>
									) : null}
								</button>
								<input
									ref={fileRef}
									type="file"
									accept="image/png,image/jpeg,image/webp"
									className="hidden"
									onChange={(e) => {
										const file = e.target.files?.[0];
										if (file) upload.mutate(file);
										e.target.value = "";
									}}
								/>
							</div>

							{/* Meta */}
							<div className="space-y-4">
								<label className="block">
									<span className="mb-1.5 block font-medium text-foreground text-sm">
										{t("blog.field_title", { defaultValue: "Title" })}
									</span>
									<input
										value={title}
										onChange={(e) => setTitle(e.target.value)}
										className="h-11 w-full rounded-input border border-border px-3.5 text-foreground outline-none focus:border-brand-primary"
									/>
								</label>
								<div className="grid gap-4 sm:grid-cols-2">
									<label className="block">
										<span className="mb-1.5 block font-medium text-foreground text-sm">
											{t("blog.category", { defaultValue: "Category" })}
										</span>
										<input
											value={category}
											onChange={(e) => setCategory(e.target.value)}
											placeholder={t("blog.category_ph", {
												defaultValue: "Learning science",
											})}
											className="h-11 w-full rounded-input border border-border px-3.5 text-foreground outline-none focus:border-brand-primary"
										/>
									</label>
									<label className="block">
										<span className="mb-1.5 block font-medium text-foreground text-sm">
											{t("blog.author", { defaultValue: "Author" })}
										</span>
										<input
											value={authorName}
											onChange={(e) => setAuthorName(e.target.value)}
											className="h-11 w-full rounded-input border border-border px-3.5 text-foreground outline-none focus:border-brand-primary"
										/>
									</label>
								</div>
								<label className="block">
									<span className="mb-1.5 block font-medium text-foreground text-sm">
										{t("blog.excerpt", { defaultValue: "Excerpt" })}
									</span>
									<textarea
										value={excerpt}
										onChange={(e) => setExcerpt(e.target.value)}
										rows={2}
										maxLength={500}
										placeholder={t("blog.excerpt_ph", {
											defaultValue: "One or two sentences shown on cards.",
										})}
										className="w-full resize-none rounded-input border border-border px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-brand-primary"
									/>
								</label>
							</div>
						</div>
					</section>

					{/* Body */}
					<section className="rounded-card border border-border bg-card p-4 shadow-card sm:p-6">
						<p className="mb-3 font-medium text-foreground text-sm">
							{t("blog.body", { defaultValue: "Body" })}
						</p>
						<RichTextEditor value={body} onChange={setBody} />
					</section>

					<div className="flex justify-end">
						<Button onClick={() => save.mutate()} disabled={save.isPending}>
							{save.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Save className="size-4" />
							)}
							{t("settings.save", { defaultValue: "Save" })}
						</Button>
					</div>
				</div>
			)}

			<ConfirmDialog
				open={deleteOpen}
				title={t("blog.delete_title", { defaultValue: "Delete post?" })}
				description={t("blog.delete_description", {
					defaultValue: "“{{title}}” will be removed.",
					title: post?.title ?? "",
				})}
				confirmLabel={t("courses.delete_confirm", { defaultValue: "Delete" })}
				cancelLabel={t("courses.delete_cancel", { defaultValue: "Cancel" })}
				isPending={removePost.isPending}
				tone="danger"
				onOpenChange={setDeleteOpen}
				onConfirm={() => removePost.mutate()}
			/>
		</StudioShell>
	);
}
