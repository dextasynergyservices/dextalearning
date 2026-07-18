import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { DurationInput } from "@/components/authoring/duration-input";
import { Button } from "@/components/ui/button";
import {
	type AssessmentDetail,
	type AssessmentGradingType,
	type AssessmentScope,
	updateAssessment,
} from "@/lib/content-api";
import { cn } from "@/lib/utils";

const GRADING: AssessmentGradingType[] = [
	"auto",
	"manual",
	"ai_assisted",
	"peer",
];

/** Optional integer field: "" ⇒ null (e.g. "no limit"/"unlimited"). */
function optInt(value: string): number | null {
	const v = value.trim();
	return v === "" ? null : Number(v);
}

/**
 * Only the summative finals carry a retry policy (§4.4.1). Lesson and module
 * quizzes are formative practice — unlimited and immediate — so the block is
 * hidden for them and its fields never reach the API (which rejects them).
 */
const FINAL_SCOPES: AssessmentScope[] = [
	"course_final",
	"path_final",
	"cohort",
];

/**
 * Assessment configuration (§4.4): pass mark, timing, retakes, question pool +
 * shuffle, grading, and the per-assessment anti-cheat measures (§4.6).
 */
export function AssessmentSettingsPanel({
	assessment,
}: {
	assessment: AssessmentDetail;
}) {
	const { t } = useTranslation("authoring");
	const queryClient = useQueryClient();
	const isFinal = FINAL_SCOPES.includes(assessment.scope);

	const [title, setTitle] = useState(assessment.title ?? "");
	const [passMark, setPassMark] = useState(String(assessment.passMark ?? 70));
	const [timeLimit, setTimeLimit] = useState(
		assessment.timeLimitMinutes == null
			? ""
			: String(assessment.timeLimitMinutes),
	);
	const [maxRetakes, setMaxRetakes] = useState(
		assessment.maxRetakes == null ? "" : String(assessment.maxRetakes),
	);
	const [cooldown, setCooldown] = useState(
		assessment.retakeCooldownHours == null
			? ""
			: String(assessment.retakeCooldownHours),
	);
	const [lockoutDays, setLockoutDays] = useState<number | null>(
		assessment.retakeLockoutDays ?? null,
	);
	const [pool, setPool] = useState(
		assessment.questionPoolSize == null
			? ""
			: String(assessment.questionPoolSize),
	);
	const [shuffleQuestions, setShuffleQuestions] = useState(
		assessment.shuffleQuestions,
	);
	const [shuffleAnswers, setShuffleAnswers] = useState(
		assessment.shuffleAnswers,
	);
	const [grading, setGrading] = useState<AssessmentGradingType>(
		assessment.gradingType ?? "auto",
	);
	const [tabLimit, setTabLimit] = useState(
		String(assessment.anticheatTabSwitchLimit ?? 3),
	);
	const [copyBlocked, setCopyBlocked] = useState(
		assessment.anticheatCopyPasteBlocked,
	);
	const [fullscreen, setFullscreen] = useState(
		assessment.anticheatFullscreenRequired,
	);
	const [camera, setCamera] = useState(assessment.anticheatCameraRequired);
	const [fastFlag, setFastFlag] = useState(
		String(assessment.anticheatTimePerQuestionFlagSeconds ?? 2),
	);

	const save = useMutation({
		mutationFn: () =>
			updateAssessment(assessment.id, {
				title: title.trim() || undefined,
				passMark: Number(passMark) || 70,
				timeLimitMinutes: optInt(timeLimit),
				...(isFinal
					? {
							maxRetakes: optInt(maxRetakes),
							retakeCooldownHours: optInt(cooldown),
							retakeLockoutDays: lockoutDays,
						}
					: {}),
				questionPoolSize: optInt(pool),
				shuffleQuestions,
				shuffleAnswers,
				gradingType: grading,
				anticheatTabSwitchLimit: Number(tabLimit) || 3,
				anticheatCopyPasteBlocked: copyBlocked,
				anticheatFullscreenRequired: fullscreen,
				anticheatCameraRequired: camera,
				anticheatTimePerQuestionFlagSeconds: Number(fastFlag) || 2,
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["assessment", assessment.id],
			});
			toast.success(t("assessment.saved", { defaultValue: "Settings saved" }));
		},
		onError: (e) => toast.error(e.message),
	});

	return (
		<section className="rounded-card border border-border bg-card shadow-card">
			<header className="border-border border-b px-4 py-3 sm:px-6">
				<h2 className="font-display text-lg text-foreground">
					{t("assessment.settings_title", {
						defaultValue: "Assessment settings",
					})}
				</h2>
				<p className="mt-0.5 text-muted-foreground text-sm">
					{isFinal
						? t("assessment.settings_subtitle", {
								defaultValue:
									"Pass mark, timing, retakes and the integrity rules learners take this under.",
							})
						: t("assessment.settings_subtitle_formative", {
								defaultValue:
									"Pass mark, timing and the integrity rules learners take this under. This is practice — retakes are unlimited; only finals limit attempts.",
							})}
				</p>
			</header>

			<div className="space-y-5 p-4 sm:p-6">
				<Field label={t("assessment.title", { defaultValue: "Title" })}>
					<input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						maxLength={200}
						placeholder={t("assessment.title_ph", {
							defaultValue: "e.g. Final assessment",
						})}
						className="h-11 w-full rounded-input border border-border px-3.5 text-foreground outline-none focus:border-brand-primary"
					/>
				</Field>

				<div className="grid gap-4 sm:grid-cols-2">
					<Field
						label={t("assessment.pass_mark", { defaultValue: "Pass mark %" })}
					>
						<NumInput
							value={passMark}
							onChange={setPassMark}
							min={0}
							max={100}
						/>
					</Field>
					<Field
						label={t("assessment.time_limit", {
							defaultValue: "Time limit (min)",
						})}
						hint={t("assessment.blank_none", { defaultValue: "Blank = none" })}
					>
						<NumInput value={timeLimit} onChange={setTimeLimit} min={1} />
					</Field>
				</div>

				{/* Retry policy (§4.4.1) — finals only; a formative lesson/module
				    quiz is unlimited practice and shows no rules at all. */}
				{!isFinal ? null : (
					<div className="rounded-card border border-border bg-muted/30 p-4">
						<div className="flex items-center gap-2 font-medium text-foreground text-sm">
							<RotateCcw className="size-4 text-brand-primary" />
							{t("assessment.retry_policy", { defaultValue: "Retry policy" })}
						</div>
						<p className="mt-1 text-muted-foreground text-xs">
							{t("assessment.retry_policy_hint", {
								defaultValue:
									"What happens when a learner doesn't pass: how many tries they get, how long they wait between tries, and whether their tries reset after a break.",
							})}
						</p>
						<div className="mt-4 grid gap-4 sm:grid-cols-3">
							<Field
								label={t("assessment.max_retakes", {
									defaultValue: "Max retakes",
								})}
								hint={t("assessment.blank_unlimited", {
									defaultValue: "Blank = unlimited",
								})}
							>
								<NumInput value={maxRetakes} onChange={setMaxRetakes} min={0} />
							</Field>
							<Field
								label={t("assessment.cooldown", {
									defaultValue: "Wait between tries (hrs)",
								})}
								hint={t("assessment.blank_none", {
									defaultValue: "Blank = none",
								})}
							>
								<NumInput value={cooldown} onChange={setCooldown} min={0} />
							</Field>
							<Field
								label={t("assessment.lockout", {
									defaultValue: "Reset tries after",
								})}
								hint={t("assessment.lockout_hint", {
									defaultValue: "Blank = tries never reset",
								})}
							>
								<DurationInput days={lockoutDays} onChange={setLockoutDays} />
							</Field>
						</div>
					</div>
				)}

				<div className="grid gap-4 sm:grid-cols-2">
					<Field
						label={t("assessment.pool", { defaultValue: "Question pool size" })}
						hint={t("assessment.pool_hint", {
							defaultValue: "Blank = ask every question",
						})}
					>
						<NumInput value={pool} onChange={setPool} min={1} />
					</Field>
					<Field label={t("assessment.grading", { defaultValue: "Grading" })}>
						<Select
							value={grading}
							onChange={(v) => setGrading(v as AssessmentGradingType)}
						>
							{GRADING.map((g) => (
								<option key={g} value={g}>
									{t(`assessment.grading_${g}`, { defaultValue: g })}
								</option>
							))}
						</Select>
					</Field>
				</div>

				<div className="grid gap-3 rounded-card border border-border p-4 sm:grid-cols-2">
					<Toggle
						checked={shuffleQuestions}
						onChange={setShuffleQuestions}
						label={t("assessment.shuffle_q", {
							defaultValue: "Shuffle questions",
						})}
					/>
					<Toggle
						checked={shuffleAnswers}
						onChange={setShuffleAnswers}
						label={t("assessment.shuffle_a", {
							defaultValue: "Shuffle answer options",
						})}
					/>
				</div>

				{/* Anti-cheat (§4.6) */}
				<div className="rounded-card border border-brand-primary/15 bg-brand-primary/5 p-4">
					<div className="flex items-center gap-2 font-medium text-brand-primary text-sm">
						<ShieldCheck className="size-4" />
						{t("assessment.anticheat", { defaultValue: "Anti-cheat" })}
					</div>
					<div className="mt-4 space-y-3">
						<Toggle
							checked={copyBlocked}
							onChange={setCopyBlocked}
							label={t("assessment.ac_copy", {
								defaultValue: "Block copy / paste",
							})}
						/>
						<Toggle
							checked={fullscreen}
							onChange={setFullscreen}
							label={t("assessment.ac_fullscreen", {
								defaultValue: "Require fullscreen",
							})}
							hint={t("assessment.ac_fullscreen_hint", {
								defaultValue: "Auto-submit after repeated exits.",
							})}
						/>
						<Toggle
							checked={camera}
							onChange={setCamera}
							label={t("assessment.ac_camera", {
								defaultValue: "Require camera monitoring",
							})}
							hint={t("assessment.ac_camera_hint", {
								defaultValue: "Face check every 30s — runs in the browser.",
							})}
						/>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field
								label={t("assessment.ac_tab_limit", {
									defaultValue: "Tab-switches before auto-submit",
								})}
							>
								<NumInput
									value={tabLimit}
									onChange={setTabLimit}
									min={1}
									max={20}
								/>
							</Field>
							<Field
								label={t("assessment.ac_fast", {
									defaultValue: "Flag answers faster than (s)",
								})}
							>
								<NumInput
									value={fastFlag}
									onChange={setFastFlag}
									min={0}
									max={120}
								/>
							</Field>
						</div>
					</div>
				</div>

				<div className="flex justify-end">
					<Button onClick={() => save.mutate()} disabled={save.isPending}>
						{save.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Save className="size-4" />
						)}
						{t("assessment.save", { defaultValue: "Save settings" })}
					</Button>
				</div>
			</div>
		</section>
	);
}

function Field({
	label,
	hint,
	children,
}: {
	label: string;
	hint?: string;
	children: ReactNode;
}) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: control passed as children.
		<label className="block">
			<span className="mb-1.5 block font-medium text-foreground text-sm">
				{label}
			</span>
			{children}
			{hint ? (
				<span className="mt-1 block text-muted-foreground text-xs">{hint}</span>
			) : null}
		</label>
	);
}

function NumInput({
	value,
	onChange,
	min,
	max,
}: {
	value: string;
	onChange: (v: string) => void;
	min?: number;
	max?: number;
}) {
	return (
		<input
			type="number"
			min={min}
			max={max}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className="h-11 w-full rounded-input border border-border px-3.5 text-foreground outline-none focus:border-brand-primary"
		/>
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
			className="h-11 w-full rounded-input border border-border bg-card px-3 text-foreground outline-none focus:border-brand-primary"
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
				<span className="block font-medium text-foreground text-sm">
					{label}
				</span>
				{hint ? (
					<span className="text-muted-foreground text-xs">{hint}</span>
				) : null}
			</span>
			<span
				className={cn(
					"relative h-6 w-11 shrink-0 rounded-full transition-colors",
					checked ? "bg-brand-solid" : "bg-slate-300",
				)}
			>
				<span
					className={cn(
						"absolute top-0.5 size-5 rounded-full bg-card shadow-sm transition-all",
						checked ? "left-[1.375rem]" : "left-0.5",
					)}
				/>
			</span>
		</button>
	);
}
