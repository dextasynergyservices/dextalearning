import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	FileText,
	Film,
	Loader2,
	Music,
	Pencil,
	PlayCircle,
	Plus,
	Trash2,
	Type,
} from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { IntroLesson } from "@/lib/content-api";

const TYPE_ICON: Record<string, ComponentType<{ className?: string }>> = {
	video: Film,
	audio: Music,
	pdf: FileText,
	text: Type,
};

/**
 * Builder card to add/edit/remove a path or cohort's intro/preview — a
 * standalone lesson authored in the normal lesson editor, played to prospective
 * learners before they enrol. Reuses the whole lesson media pipeline.
 */
export function IntroManager({
	id,
	intro,
	editorArea,
	queryKey,
	createFn,
	removeFn,
}: {
	id: string;
	intro: IntroLesson | null;
	editorArea: "instructor" | "admin";
	queryKey: unknown[];
	createFn: (id: string) => Promise<{ id: string }>;
	removeFn: (id: string) => Promise<unknown>;
}) {
	const { t } = useTranslation("authoring");
	const navigate = useNavigate();
	const qc = useQueryClient();

	const openEditor = (lessonId: string) =>
		navigate({
			to:
				editorArea === "admin"
					? "/admin/lessons/$lessonId"
					: "/instructor/lessons/$lessonId",
			params: { lessonId },
		});

	const create = useMutation({
		mutationFn: () => createFn(id),
		onSuccess: (res) => openEditor(res.id),
		onError: (e) => toast.error(e.message),
	});
	const remove = useMutation({
		mutationFn: () => removeFn(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey });
			toast.success(t("intro.removed", { defaultValue: "Intro removed" }));
		},
		onError: (e) => toast.error(e.message),
	});

	const ready =
		intro?.contentType != null &&
		(Boolean(intro.videoKeysJson) ||
			Boolean(intro.audioKey) ||
			Boolean(intro.pdfKey) ||
			Boolean(intro.contentText?.trim()));
	const Icon = intro?.contentType
		? (TYPE_ICON[intro.contentType] ?? Type)
		: Type;

	return (
		<section className="rounded-card border border-border bg-card p-4 shadow-card sm:p-6">
			<h2 className="font-display text-lg text-foreground">
				{t("intro.title", { defaultValue: "Intro / preview" })}
			</h2>
			<p className="mt-0.5 mb-3 text-muted-foreground text-sm">
				{t("intro.subtitle", {
					defaultValue:
						"An optional video, audio, PDF or text shown to learners before they enrol — your own preview for this.",
				})}
			</p>

			{intro ? (
				<div className="flex items-center gap-3 rounded-card border border-border bg-muted px-4 py-3">
					<span className="flex size-10 shrink-0 items-center justify-center rounded-btn bg-card text-brand-primary shadow-sm">
						<Icon className="size-5" />
					</span>
					<div className="min-w-0 flex-1">
						<p className="font-medium text-foreground text-sm">
							{intro.contentType
								? t(`type.${intro.contentType}`, {
										defaultValue: intro.contentType,
									})
								: t("intro.untyped", { defaultValue: "Not set up yet" })}
						</p>
						<p className="text-xs">
							{ready ? (
								<span className="flex items-center gap-1 text-success">
									<PlayCircle className="size-3.5" />
									{t("intro.ready", { defaultValue: "Ready to preview" })}
								</span>
							) : (
								<span className="text-amber-700">
									{t("intro.needs_media", {
										defaultValue: "Add media in the editor to finish",
									})}
								</span>
							)}
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => openEditor(intro.id)}
					>
						<Pencil className="size-4" />
						{t("intro.edit", { defaultValue: "Edit" })}
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="text-error hover:bg-error/5"
						onClick={() => remove.mutate()}
						disabled={remove.isPending}
						aria-label={t("intro.remove", { defaultValue: "Remove intro" })}
					>
						{remove.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Trash2 className="size-4" />
						)}
					</Button>
				</div>
			) : (
				<Button
					type="button"
					variant="outline"
					onClick={() => create.mutate()}
					disabled={create.isPending}
				>
					{create.isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Plus className="size-4" />
					)}
					{t("intro.add", { defaultValue: "Add intro / preview" })}
				</Button>
			)}
		</section>
	);
}
