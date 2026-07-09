import { CheckCircle2, FileUp, Loader2, UploadCloud } from "lucide-react";
import { type DragEvent, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UploadFieldProps {
	label: string;
	hint?: string;
	accept: string;
	/** Returns once the upload completes; `onProgress` reports 0–100. */
	onUpload: (file: File, onProgress: (pct: number) => void) => Promise<unknown>;
	/** Show a "ready"/"processing" badge for already-attached media. */
	status?: "ready" | "processing" | null;
	successMessage?: string;
}

/**
 * Reusable drag-and-drop upload widget with live progress. Surfaces server
 * error codes (e.g. MEDIA_DURATION_EXCEEDED) via translated toasts.
 */
export function UploadField({
	label,
	hint,
	accept,
	onUpload,
	status,
	successMessage,
}: UploadFieldProps) {
	const { t } = useTranslation(["authoring", "common"]);
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const [pct, setPct] = useState<number | null>(null);
	const [dragging, setDragging] = useState(false);
	const [fileName, setFileName] = useState<string | null>(null);

	const formatSize = (bytes: number) => {
		if (bytes < 1024 * 1024)
			return `${Math.max(1, Math.round(bytes / 1024))} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};

	const handleFile = async (file: File | undefined) => {
		if (!file) return;
		setFileName(`${file.name} · ${formatSize(file.size)}`);
		setPct(0);
		try {
			await onUpload(file, setPct);
			toast.success(successMessage ?? t("authoring:lesson.upload_complete"));
		} catch (error) {
			const message = error instanceof Error ? error.message : "toasts.error";
			// Server returns i18n keys (e.g. errors.media.duration_exceeded).
			toast.error(t(message, { ns: "common", defaultValue: message }));
		} finally {
			setPct(null);
			setFileName(null);
			if (inputRef.current) inputRef.current.value = "";
		}
	};

	const onDrop = (event: DragEvent<HTMLButtonElement>) => {
		event.preventDefault();
		setDragging(false);
		void handleFile(event.dataTransfer.files[0]);
	};

	const busy = pct !== null;

	return (
		<div>
			<div className="mb-1.5 flex items-center justify-between">
				<span className="font-medium text-foreground text-sm">{label}</span>
				{status === "ready" ? (
					<span className="inline-flex items-center gap-1 text-success text-xs">
						<CheckCircle2 className="size-3.5" /> {t("authoring:lesson.ready")}
					</span>
				) : status === "processing" ? (
					<span className="inline-flex items-center gap-1 text-amber-600 text-xs dark:text-amber-400">
						<Loader2 className="size-3.5 animate-spin" />
						{t("authoring:lesson.processing")}
					</span>
				) : null}
			</div>

			<button
				type="button"
				onClick={() => inputRef.current?.click()}
				onDragOver={(e) => {
					e.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={onDrop}
				disabled={busy}
				className={cn(
					"flex w-full flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed px-4 py-7 text-center transition-colors sm:py-8",
					dragging
						? "border-brand-primary bg-brand-primary-light"
						: "border-border hover:border-brand-primary/50 hover:bg-accent",
					busy && "opacity-70",
				)}
			>
				{busy ? (
					<>
						<span className="flex size-12 items-center justify-center rounded-full bg-brand-primary-light text-brand-primary">
							<Loader2 className="size-6 animate-spin" />
						</span>
						<div>
							<span className="block font-medium text-foreground text-sm">
								{t("authoring:lesson.uploading", { pct })}
							</span>
							{fileName ? (
								<span className="mt-1 block text-muted-foreground text-xs">
									{fileName}
								</span>
							) : null}
						</div>
						<div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted">
							<div
								className="h-full rounded-full bg-brand-primary transition-all"
								style={{ width: `${pct}%` }}
							/>
						</div>
					</>
				) : (
					<>
						<span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
							{dragging ? (
								<FileUp className="size-6 text-brand-primary" />
							) : (
								<UploadCloud className="size-6" />
							)}
						</span>
						<div>
							<span className="block font-medium text-foreground text-sm">
								{t("authoring:lesson.drop_or_browse")}
							</span>
							{hint ? (
								<span className="mt-1 block text-muted-foreground text-xs">
									{hint}
								</span>
							) : null}
						</div>
					</>
				)}
			</button>

			<input
				id={inputId}
				ref={inputRef}
				type="file"
				accept={accept}
				className="sr-only"
				onChange={(e) => void handleFile(e.target.files?.[0])}
			/>
		</div>
	);
}
