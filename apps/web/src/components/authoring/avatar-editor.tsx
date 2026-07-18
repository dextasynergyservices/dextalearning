import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { deleteAvatar, uploadAvatar } from "@/lib/content-api";
import { cn } from "@/lib/utils";

function initials(name: string) {
	return (
		name
			.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? "")
			.join("") || "U"
	);
}

interface AvatarEditorProps {
	image: string | null;
	name: string;
	/** Called with the new image URL (or null after removal). */
	onChange: (image: string | null) => void;
}

/**
 * Tap-to-edit avatar — a pen badge signals it's editable; clicking opens a
 * native bottom sheet on mobile / a popover on desktop with **Change photo** and
 * **Remove photo**. Handles the upload/delete itself and reports the new image.
 */
export function AvatarEditor({ image, name, onChange }: AvatarEditorProps) {
	const { t } = useTranslation("authoring");
	const isDesktop = useIsDesktop();
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open || !isDesktop) return;
		const onPointer = (event: MouseEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onPointer);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onPointer);
			document.removeEventListener("keydown", onKey);
		};
	}, [open, isDesktop]);

	const onUpload = async (file: File) => {
		setBusy(true);
		try {
			const res = await uploadAvatar(file);
			onChange(res.image);
			toast.success(
				t("profile.photo_updated", { defaultValue: "Photo updated." }),
			);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Upload failed");
		} finally {
			setBusy(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	};

	const onRemove = async () => {
		setOpen(false);
		setBusy(true);
		try {
			const res = await deleteAvatar();
			onChange(res.image);
			toast.success(
				t("profile.photo_removed", { defaultValue: "Photo removed." }),
			);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Remove failed");
		} finally {
			setBusy(false);
		}
	};

	const itemCls = (sheet: boolean) =>
		cn(
			"flex w-full items-center gap-3 rounded-btn font-medium text-sm transition-colors hover:bg-accent",
			sheet ? "px-3 py-3.5" : "px-3 py-2.5",
		);

	const actions = (sheet: boolean) => (
		<>
			<button
				type="button"
				onClick={() => {
					setOpen(false);
					fileRef.current?.click();
				}}
				className={cn(itemCls(sheet), "text-foreground")}
			>
				<ImagePlus className="size-5 text-brand-primary" />
				{t("profile.change_photo", { defaultValue: "Change photo" })}
			</button>
			{image ? (
				<button
					type="button"
					onClick={onRemove}
					className={cn(itemCls(sheet), "text-error")}
				>
					<Trash2 className="size-5" />
					{t("profile.remove_photo", { defaultValue: "Remove photo" })}
				</button>
			) : null}
		</>
	);

	return (
		<div ref={rootRef} className="relative inline-block">
			<input
				ref={fileRef}
				type="file"
				accept="image/png,image/jpeg,image/webp"
				className="hidden"
				onChange={(event) => {
					const file = event.target.files?.[0];
					if (file) void onUpload(file);
				}}
			/>

			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				disabled={busy}
				aria-label={t("profile.edit_photo", { defaultValue: "Edit photo" })}
				className="group relative block size-24 rounded-full"
			>
				{image ? (
					<img
						src={image}
						alt=""
						className="size-24 rounded-full object-cover"
					/>
				) : (
					<span className="flex size-24 items-center justify-center rounded-full bg-brand-solid font-display text-2xl text-white">
						{initials(name)}
					</span>
				)}
				<span className="absolute right-0 bottom-0 flex size-8 items-center justify-center rounded-full border-2 border-card bg-brand-solid text-white shadow-sm transition-transform group-hover:scale-105 group-active:scale-95">
					{busy ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Pencil className="size-3.5" />
					)}
				</span>
			</button>

			{isDesktop && open ? (
				<div className="absolute top-full left-0 z-40 mt-2 w-52 overflow-hidden rounded-card border border-border bg-popover p-1.5 shadow-card-hover">
					{actions(false)}
				</div>
			) : null}

			{!isDesktop
				? createPortal(
						<AnimatePresence>
							{open ? (
								<div className="fixed inset-0 z-[70]">
									<motion.button
										type="button"
										aria-label={t("profile.close", { defaultValue: "Close" })}
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
										onClick={() => setOpen(false)}
										className="absolute inset-0 bg-slate-900/40"
									/>
									<motion.div
										initial={{ y: "100%" }}
										animate={{ y: 0 }}
										exit={{ y: "100%" }}
										transition={{ type: "spring", stiffness: 380, damping: 38 }}
										drag="y"
										dragConstraints={{ top: 0, bottom: 0 }}
										dragElastic={{ top: 0, bottom: 0.5 }}
										onDragEnd={(_, info) => {
											if (info.offset.y > 90 || info.velocity.y > 600) {
												setOpen(false);
											}
										}}
										className="absolute inset-x-0 bottom-0 touch-none rounded-t-card border-border border-t bg-card p-3 shadow-modal"
										style={{
											paddingBottom:
												"calc(0.75rem + env(safe-area-inset-bottom))",
										}}
									>
										<div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border" />
										<p className="px-3 py-1 font-stats font-semibold text-muted-foreground text-xs uppercase tracking-wide">
											{t("profile.photo_menu", {
												defaultValue: "Profile photo",
											})}
										</p>
										{actions(true)}
									</motion.div>
								</div>
							) : null}
						</AnimatePresence>,
						document.body,
					)
				: null}
		</div>
	);
}
