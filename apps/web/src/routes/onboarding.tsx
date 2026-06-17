import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronLeft, PartyPopper } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
	component: OnboardingPage,
});

const STEPS = ["language", "goals", "level", "hours", "schedule"] as const;
type Step = (typeof STEPS)[number];

const OPTIONS: Record<Exclude<Step, "language">, string[]> = {
	goals: ["teaching", "certificates", "methods", "career", "community"],
	level: ["beginner", "intermediate", "advanced"],
	hours: ["low", "medium", "high", "max"],
	schedule: ["morning", "afternoon", "evening", "weekend", "flexible"],
};

const LANGUAGE_LABELS: Record<string, string> = {
	en: "English",
	fr: "Français",
	es: "Español",
	pcm: "Naijá (Pidgin)",
};

const slide = {
	enter: (dir: number) => ({ x: dir > 0 ? 32 : -32, opacity: 0 }),
	center: { x: 0, opacity: 1 },
	exit: (dir: number) => ({ x: dir > 0 ? -32 : 32, opacity: 0 }),
};

function OnboardingPage() {
	const { t, i18n } = useTranslation("onboarding");
	const navigate = useNavigate();
	const [index, setIndex] = useState(0);
	const [direction, setDirection] = useState(1);
	const [goals, setGoals] = useState<string[]>([]);
	const [level, setLevel] = useState<string | null>(null);
	const [hours, setHours] = useState<string | null>(null);
	const [schedule, setSchedule] = useState<string | null>(null);

	const done = index >= STEPS.length;
	const step = STEPS[index];

	const canContinue =
		step === "language" ||
		(step === "goals" && goals.length > 0) ||
		(step === "level" && level !== null) ||
		(step === "hours" && hours !== null) ||
		(step === "schedule" && schedule !== null);

	const go = (next: number) => {
		setDirection(next > index ? 1 : -1);
		setIndex(next);
	};

	const toggleGoal = (goal: string) =>
		setGoals((current) =>
			current.includes(goal)
				? current.filter((value) => value !== goal)
				: [...current, goal],
		);

	if (done) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
				<motion.div
					initial={{ scale: 0.8, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{ type: "spring", stiffness: 200, damping: 16 }}
					className="flex size-20 items-center justify-center rounded-full bg-success/15 text-success"
				>
					<PartyPopper className="size-10" />
				</motion.div>
				<h1 className="mt-6 font-display text-3xl tracking-tight text-slate-900">
					{t("done.title")}
				</h1>
				<p className="mt-2 max-w-sm text-slate-500">{t("done.subtitle")}</p>
				<button
					type="button"
					onClick={() => navigate({ to: "/dashboard" })}
					className={cn(
						buttonVariants({ variant: "primary", size: "lg" }),
						"mt-8",
					)}
				>
					{t("done.cta")} <ArrowRight className="size-4" />
				</button>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen flex-col bg-white">
			{/* Top bar: back + progress + skip */}
			<header
				className="flex items-center gap-3 px-5 py-4"
				style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
			>
				{index > 0 ? (
					<button
						type="button"
						onClick={() => go(index - 1)}
						aria-label={t("back")}
						className="-ml-2 flex size-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100"
					>
						<ChevronLeft className="size-5" />
					</button>
				) : (
					<Logo className="text-xl text-slate-900" />
				)}
				<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
					<motion.div
						className="h-full rounded-full bg-brand-primary"
						initial={false}
						animate={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
						transition={{ duration: 0.3 }}
					/>
				</div>
				<button
					type="button"
					onClick={() => navigate({ to: "/dashboard" })}
					className="text-slate-400 text-sm hover:text-slate-600"
				>
					{t("skip")}
				</button>
			</header>

			{/* Step content */}
			<main className="flex flex-1 flex-col px-6 pt-4 pb-6">
				<p className="font-stats text-brand-primary text-sm">
					{t("progress", { current: index + 1, total: STEPS.length })}
				</p>
				<div className="relative mt-3 flex-1">
					<AnimatePresence mode="wait" custom={direction}>
						<motion.div
							key={step}
							custom={direction}
							variants={slide}
							initial="enter"
							animate="center"
							exit="exit"
							transition={{ duration: 0.25, ease: "easeOut" }}
							className="mx-auto max-w-lg"
						>
							<h1 className="font-display text-2xl tracking-tight text-slate-900 sm:text-3xl">
								{t(`${step}.title`)}
							</h1>
							<p className="mt-2 text-slate-500">{t(`${step}.subtitle`)}</p>

							<div className="mt-6 space-y-3">
								{step === "language"
									? SUPPORTED_LANGUAGES.map((lng) => (
											<OptionRow
												key={lng}
												label={LANGUAGE_LABELS[lng] ?? lng}
												selected={i18n.resolvedLanguage === lng}
												onClick={() => {
													void i18n.changeLanguage(lng);
												}}
											/>
										))
									: OPTIONS[step].map((value) => (
											<OptionRow
												key={value}
												label={t(`${step}.options.${value}`)}
												selected={
													step === "goals"
														? goals.includes(value)
														: step === "level"
															? level === value
															: step === "hours"
																? hours === value
																: schedule === value
												}
												onClick={() => {
													if (step === "goals") toggleGoal(value);
													else if (step === "level") setLevel(value);
													else if (step === "hours") setHours(value);
													else setSchedule(value);
												}}
											/>
										))}
							</div>
						</motion.div>
					</AnimatePresence>
				</div>

				<div className="mx-auto w-full max-w-lg pt-6">
					<Button
						type="button"
						size="lg"
						disabled={!canContinue}
						onClick={() => go(index + 1)}
						className="w-full"
					>
						{index === STEPS.length - 1 ? t("finish") : t("next")}
						<ArrowRight className="size-4" />
					</Button>
				</div>
			</main>
		</div>
	);
}

function OptionRow({
	label,
	selected,
	onClick,
}: {
	label: string;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex w-full items-center justify-between rounded-card border px-5 py-4 text-left font-medium transition-all active:scale-[0.99]",
				selected
					? "border-brand-primary bg-brand-primary-light text-brand-primary"
					: "border-slate-200 text-slate-700 hover:border-slate-300",
			)}
		>
			{label}
			<span
				className={cn(
					"flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
					selected
						? "border-brand-primary bg-brand-primary text-white"
						: "border-slate-300",
				)}
			>
				{selected ? <Check className="size-3.5" /> : null}
			</span>
		</button>
	);
}
