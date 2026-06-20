import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Save } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	formatMoney,
	type PathDetail,
	updatePath,
	uploadPathThumbnail,
} from "@/lib/content-api";
import { cn } from "@/lib/utils";

const LEVELS = ["beginner", "intermediate", "advanced", "mixed"] as const;
const CURRENCIES = ["NGN", "USD", "GHS", "KES", "ZAR", "GBP", "EUR"] as const;

/**
 * Learning Path settings (§4.1, §4.11): thumbnail, description, outcome, level,
 * estimated hours, pricing and Earn-Back. The Earn-Back % governs the whole
 * path purchase. Free paths hide pricing/Earn-Back.
 */
export function PathSettingsPanel({ path }: { path: PathDetail }) {
	const { t } = useTranslation("authoring");
	const queryClient = useQueryClient();
	const fileRef = useRef<HTMLInputElement>(null);

	const [thumbUrl, setThumbUrl] = useState(path.thumbnailUrl);
	const [description, setDescription] = useState(path.description ?? "");
	const [outcome, setOutcome] = useState(path.outcomeStatement ?? "");
	const [level, setLevel] = useState(path.level ?? "");
	const [hours, setHours] = useState(String(path.estimatedHours ?? ""));
	const [isFree, setIsFree] = useState(path.isFree);
	const [price, setPrice] = useState(String(path.price ?? 0));
	const [currency, setCurrency] = useState(path.currency ?? "NGN");
	const [earnBack, setEarnBack] = useState(path.isEarnBackEligible);
	const [pct, setPct] = useState(String(path.earnBackPercentage ?? 100));
	const [deadline, setDeadline] = useState(
		String(path.earnBackDeadlineDays ?? 30),
	);

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["path", path.id] });

	const save = useMutation({
		mutationFn: () =>
			updatePath(path.id, {
				description: description.trim() || undefined,
				outcomeStatement: outcome.trim() || undefined,
				level: level || undefined,
				estimatedHours: hours ? Number(hours) : undefined,
				isFree,
				price: isFree ? undefined : Number(price) || 0,
				currency,
				isEarnBackEligible: isFree ? false : earnBack,
				earnBackPercentage:
					!isFree && earnBack ? Number(pct) || 100 : undefined,
				earnBackDeadlineDays:
					!isFree && earnBack ? Number(deadline) || 30 : undefined,
			}),
		onSuccess: () => {
			invalidate();
			toast.success(t("settings.saved", { defaultValue: "Settings saved" }));
		},
		onError: (e) => toast.error(e.message),
	});

	const upload = useMutation({
		mutationFn: (file: File) => uploadPathThumbnail(path.id, file),
		onSuccess: (res) => {
			setThumbUrl(res.thumbnailUrl);
			invalidate();
			toast.success(
				t("settings.thumb_saved", { defaultValue: "Thumbnail updated" }),
			);
		},
		onError: (e) => toast.error(e.message),
	});

	const priceNum = Number(price) || 0;
	const pctNum = Math.min(100, Math.max(1, Number(pct) || 0));
	const earnBase = Math.round((priceNum * pctNum) / 100);

	return (
		<section className="rounded-card border border-slate-200 bg-white shadow-card">
			<header className="border-slate-100 border-b px-4 py-3 sm:px-6">
				<h2 className="font-display text-slate-900 text-lg">
					{t("paths.settings_title", { defaultValue: "Path settings" })}
				</h2>
				<p className="mt-0.5 text-slate-500 text-sm">
					{t("paths.settings_subtitle", {
						defaultValue:
							"Thumbnail, outcome, pricing and Earn-Back learners see on the catalogue.",
					})}
				</p>
			</header>

			<div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[260px_1fr]">
				<div>
					<p className="mb-2 font-medium text-slate-700 text-sm">
						{t("settings.thumbnail", { defaultValue: "Thumbnail" })}
					</p>
					<button
						type="button"
						onClick={() => fileRef.current?.click()}
						className={cn(
							"group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-card border-2 border-slate-200 border-dashed bg-slate-50 transition-colors hover:border-brand-primary/50",
							thumbUrl && "border-solid",
						)}
					>
						{thumbUrl ? (
							<img src={thumbUrl} alt="" className="size-full object-cover" />
						) : (
							<span className="flex flex-col items-center gap-1 text-slate-400">
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
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="mt-2 w-full"
						onClick={() => fileRef.current?.click()}
						disabled={upload.isPending}
					>
						<ImagePlus className="size-4" />
						{thumbUrl
							? t("settings.replace_image", { defaultValue: "Replace image" })
							: t("settings.upload_image", { defaultValue: "Upload image" })}
					</Button>
				</div>

				<div className="space-y-5">
					<Field
						label={t("settings.description", { defaultValue: "Description" })}
					>
						<textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={2}
							maxLength={5000}
							className="w-full resize-none rounded-input border border-slate-200 px-3.5 py-2.5 text-slate-900 text-sm outline-none focus:border-brand-primary"
						/>
					</Field>

					<Field
						label={t("paths.outcome", { defaultValue: "Outcome statement" })}
					>
						<textarea
							value={outcome}
							onChange={(e) => setOutcome(e.target.value)}
							rows={2}
							maxLength={2000}
							placeholder={t("paths.outcome_ph", {
								defaultValue: "By the end, learners will be able to…",
							})}
							className="w-full resize-none rounded-input border border-slate-200 px-3.5 py-2.5 text-slate-900 text-sm outline-none focus:border-brand-primary"
						/>
					</Field>

					<div className="grid gap-4 sm:grid-cols-2">
						<Field label={t("settings.level", { defaultValue: "Level" })}>
							<Select value={level} onChange={setLevel}>
								<option value="">
									{t("settings.level_any", { defaultValue: "Any level" })}
								</option>
								{LEVELS.map((l) => (
									<option key={l} value={l}>
										{t(`settings.level_${l}`, { defaultValue: l })}
									</option>
								))}
							</Select>
						</Field>
						<Field
							label={t("paths.estimated_hours", {
								defaultValue: "Estimated hours",
							})}
						>
							<input
								type="number"
								min={0}
								value={hours}
								onChange={(e) => setHours(e.target.value)}
								className="h-11 w-full rounded-input border border-slate-200 px-3.5 text-slate-900 outline-none focus:border-brand-primary"
							/>
						</Field>
					</div>

					<div className="rounded-card border border-slate-200 p-4">
						<Toggle
							checked={!isFree}
							onChange={(on) => setIsFree(!on)}
							label={t("settings.paid", { defaultValue: "Paid path" })}
							hint={t("settings.paid_hint", {
								defaultValue: "Off = free for everyone.",
							})}
						/>
						{!isFree ? (
							<div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]">
								<Field label={t("settings.price", { defaultValue: "Price" })}>
									<input
										type="number"
										min={0}
										value={price}
										onChange={(e) => setPrice(e.target.value)}
										className="h-11 w-full rounded-input border border-slate-200 px-3.5 text-slate-900 outline-none focus:border-brand-primary"
									/>
								</Field>
								<Field
									label={t("settings.currency", { defaultValue: "Currency" })}
								>
									<Select value={currency} onChange={setCurrency}>
										{CURRENCIES.map((c) => (
											<option key={c} value={c}>
												{c}
											</option>
										))}
									</Select>
								</Field>
							</div>
						) : null}
					</div>

					{!isFree ? (
						<div className="rounded-card border border-brand-accent/30 bg-brand-accent-light/30 p-4">
							<Toggle
								checked={earnBack}
								onChange={setEarnBack}
								label={t("settings.earnback", { defaultValue: "Earn-Back" })}
								hint={t("paths.earnback_hint", {
									defaultValue:
										"The % governs the whole path purchase, overriding the courses inside it.",
								})}
							/>
							{earnBack ? (
								<>
									<div className="mt-4 grid gap-3 sm:grid-cols-2">
										<Field
											label={t("settings.earnback_pct", {
												defaultValue: "Earn-Back %",
											})}
										>
											<input
												type="number"
												min={1}
												max={100}
												value={pct}
												onChange={(e) => setPct(e.target.value)}
												className="h-11 w-full rounded-input border border-slate-200 px-3.5 text-slate-900 outline-none focus:border-brand-primary"
											/>
										</Field>
										<Field
											label={t("settings.deadline", {
												defaultValue: "Deadline (days)",
											})}
										>
											<input
												type="number"
												min={1}
												max={365}
												value={deadline}
												onChange={(e) => setDeadline(e.target.value)}
												className="h-11 w-full rounded-input border border-slate-200 px-3.5 text-slate-900 outline-none focus:border-brand-primary"
											/>
										</Field>
									</div>
									<p className="mt-3 text-amber-800 text-sm">
										{t("settings.earnback_preview", {
											defaultValue:
												"Learners can earn back {{pct}}% — {{amount}} of {{price}}.",
											pct: pctNum,
											amount: formatMoney(currency, earnBase),
											price: formatMoney(currency, priceNum),
										})}
									</p>
								</>
							) : null}
						</div>
					) : null}

					<div className="flex justify-end">
						<Button onClick={() => save.mutate()} disabled={save.isPending}>
							{save.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Save className="size-4" />
							)}
							{t("settings.save", { defaultValue: "Save settings" })}
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as `children` and wrapped by the label.
		<label className="block">
			<span className="mb-1.5 block font-medium text-slate-700 text-sm">
				{label}
			</span>
			{children}
		</label>
	);
}

function Select({
	value,
	onChange,
	children,
}: {
	value: string;
	onChange: (v: string) => void;
	children: ReactNode;
}) {
	return (
		<select
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className="h-11 w-full rounded-input border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:border-brand-primary"
		>
			{children}
		</select>
	);
}

function Toggle({
	checked,
	onChange,
	label,
	hint,
}: {
	checked: boolean;
	onChange: (on: boolean) => void;
	label: string;
	hint?: string;
}) {
	return (
		<button
			type="button"
			onClick={() => onChange(!checked)}
			className="flex w-full items-center justify-between gap-3 text-left"
		>
			<span>
				<span className="block font-medium text-slate-800 text-sm">
					{label}
				</span>
				{hint ? <span className="text-slate-500 text-xs">{hint}</span> : null}
			</span>
			<span
				className={cn(
					"relative h-6 w-11 shrink-0 rounded-full transition-colors",
					checked ? "bg-brand-primary" : "bg-slate-300",
				)}
			>
				<span
					className={cn(
						"absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all",
						checked ? "left-[1.375rem]" : "left-0.5",
					)}
				/>
			</span>
		</button>
	);
}
