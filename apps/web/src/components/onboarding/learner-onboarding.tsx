import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
	ArrowRight,
	Award,
	CalendarDays,
	Clock3,
	GraduationCap,
	Lightbulb,
	type LucideIcon,
	MessageCircle,
	PartyPopper,
	Rocket,
	Shuffle,
	Sparkles,
	Sprout,
	Sun,
	Sunrise,
	Sunset,
	TrendingUp,
	Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PublicCourseCard } from "@/components/catalog/public-cards";
import { Button, buttonVariants } from "@/components/ui/button";
import { homeForRole, useSession } from "@/lib/auth-client";
import {
	getRecommended,
	type LearnerOnboardingPayload,
	saveLearnerOnboarding,
} from "@/lib/content-api";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { OnboardingShell } from "./onboarding-shell";
import { OptionCard } from "./option-card";

const LANGUAGE_LABELS: Record<string, string> = {
	en: "English",
	fr: "Français",
	es: "Español",
	pcm: "Naijá (Pidgin)",
};

const GOAL_ICONS: Record<string, LucideIcon> = {
	teaching: GraduationCap,
	certificates: Award,
	methods: Lightbulb,
	career: TrendingUp,
	community: Users,
};
const LEVEL_ICONS: Record<string, LucideIcon> = {
	beginner: Sprout,
	intermediate: Sparkles,
	advanced: Rocket,
};
const SCHEDULE_ICONS: Record<string, LucideIcon> = {
	morning: Sunrise,
	afternoon: Sun,
	evening: Sunset,
	weekend: CalendarDays,
	flexible: Shuffle,
};

const GOALS = ["teaching", "certificates", "methods", "career", "community"];
const LEVELS = ["beginner", "intermediate", "advanced"];
const HOURS = ["low", "medium", "high", "max"];
const SCHEDULES = ["morning", "afternoon", "evening", "weekend", "flexible"];

const slide = {
	enter: (dir: number) => ({ x: dir > 0 ? 28 : -28, opacity: 0 }),
	center: { x: 0, opacity: 1 },
	exit: (dir: number) => ({ x: dir > 0 ? -28 : 28, opacity: 0 }),
};

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
	return (
		<>
			<h1 className="font-display text-2xl tracking-tight text-foreground sm:text-3xl">
				{title}
			</h1>
			<p className="mt-2 text-muted-foreground">{subtitle}</p>
		</>
	);
}

/** Learner onboarding wizard (§8.1) — persists answers, then activates. */
export function LearnerOnboarding() {
	const { t, i18n } = useTranslation("onboarding");
	const navigate = useNavigate();
	const { data: session } = useSession();
	const home = homeForRole(
		(session?.user as { role?: string } | undefined)?.role,
	);
	const hasPhone = Boolean((session?.user as { phone?: string })?.phone);

	const steps = useMemo(
		() =>
			["language", "goals", "level", "hours", "schedule", "whatsapp"].filter(
				(s) => s !== "whatsapp" || !hasPhone,
			),
		[hasPhone],
	);

	const [index, setIndex] = useState(0);
	const [direction, setDirection] = useState(1);
	const [goals, setGoals] = useState<string[]>([]);
	const [level, setLevel] = useState<string | null>(null);
	const [hours, setHours] = useState<string | null>(null);
	const [schedule, setSchedule] = useState<string | null>(null);
	const [phone, setPhone] = useState("");
	const [whatsappOptIn, setWhatsappOptIn] = useState(false);
	const [saving, setSaving] = useState(false);
	const [done, setDone] = useState(false);

	const step = steps[index];
	const isLast = index === steps.length - 1;

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

	const canContinue =
		step === "language" ||
		(step === "goals" && goals.length > 0) ||
		(step === "level" && level !== null) ||
		(step === "hours" && hours !== null) ||
		(step === "schedule" && schedule !== null) ||
		step === "whatsapp";

	const finish = async () => {
		setSaving(true);
		const payload: LearnerOnboardingPayload = {
			language: i18n.resolvedLanguage,
			goals,
			skillLevel: level ?? undefined,
			weeklyHours: hours ?? undefined,
			studySchedule: schedule ?? undefined,
			whatsappOptIn,
			phone: phone.trim() || undefined,
		};
		try {
			await saveLearnerOnboarding(payload);
		} catch (error) {
			// Non-blocking — preferences are a bonus, never gate the learner.
			toast.error(error instanceof Error ? error.message : t("save_error"));
		} finally {
			setSaving(false);
			setDone(true);
		}
	};

	if (done) {
		return <Activation home={home} />;
	}

	return (
		<OnboardingShell
			stepIndex={index}
			stepCount={steps.length}
			asideTitle={t("aside.learner_title")}
			asideSubtitle={t("aside.learner_subtitle")}
			canContinue={canContinue}
			busy={saving}
			continueLabel={isLast ? t("finish") : t("next")}
			onContinue={() => (isLast ? finish() : go(index + 1))}
			onBack={index > 0 ? () => go(index - 1) : undefined}
			onSkip={() => navigate({ to: home })}
		>
			<AnimatePresence mode="wait" custom={direction}>
				<motion.div
					key={step}
					custom={direction}
					variants={slide}
					initial="enter"
					animate="center"
					exit="exit"
					transition={{ duration: 0.25, ease: "easeOut" }}
				>
					{step === "language" ? (
						<>
							<StepHeader
								title={t("language.title")}
								subtitle={t("language.subtitle")}
							/>
							<div className="mt-6 space-y-3">
								{SUPPORTED_LANGUAGES.map((lng) => (
									<OptionCard
										key={lng}
										label={LANGUAGE_LABELS[lng] ?? lng}
										selected={i18n.resolvedLanguage === lng}
										onClick={() => void i18n.changeLanguage(lng)}
									/>
								))}
							</div>
						</>
					) : null}

					{step === "goals" ? (
						<>
							<StepHeader
								title={t("goals.title")}
								subtitle={t("goals.subtitle")}
							/>
							<div className="mt-6 space-y-3">
								{GOALS.map((value) => (
									<OptionCard
										key={value}
										control="checkbox"
										icon={GOAL_ICONS[value]}
										label={t(`goals.options.${value}`)}
										selected={goals.includes(value)}
										onClick={() => toggleGoal(value)}
									/>
								))}
							</div>
						</>
					) : null}

					{step === "level" ? (
						<>
							<StepHeader
								title={t("level.title")}
								subtitle={t("level.subtitle")}
							/>
							<div className="mt-6 space-y-3">
								{LEVELS.map((value) => (
									<OptionCard
										key={value}
										icon={LEVEL_ICONS[value]}
										label={t(`level.options.${value}`)}
										selected={level === value}
										onClick={() => setLevel(value)}
									/>
								))}
							</div>
						</>
					) : null}

					{step === "hours" ? (
						<>
							<StepHeader
								title={t("hours.title")}
								subtitle={t("hours.subtitle")}
							/>
							<div className="mt-6 space-y-3">
								{HOURS.map((value) => (
									<OptionCard
										key={value}
										icon={Clock3}
										label={t(`hours.options.${value}`)}
										selected={hours === value}
										onClick={() => setHours(value)}
									/>
								))}
							</div>
						</>
					) : null}

					{step === "schedule" ? (
						<>
							<StepHeader
								title={t("schedule.title")}
								subtitle={t("schedule.subtitle")}
							/>
							<div className="mt-6 space-y-3">
								{SCHEDULES.map((value) => (
									<OptionCard
										key={value}
										icon={SCHEDULE_ICONS[value]}
										label={t(`schedule.options.${value}`)}
										selected={schedule === value}
										onClick={() => setSchedule(value)}
									/>
								))}
							</div>
						</>
					) : null}

					{step === "whatsapp" ? (
						<>
							<StepHeader
								title={t("whatsapp.title")}
								subtitle={t("whatsapp.subtitle")}
							/>
							<div className="mt-6 space-y-3">
								<input
									type="tel"
									value={phone}
									onChange={(e) => setPhone(e.target.value)}
									placeholder={t("whatsapp.placeholder")}
									className="h-12 w-full rounded-input border border-border bg-card px-4 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-primary"
								/>
								<OptionCard
									control="checkbox"
									icon={MessageCircle}
									label={t("whatsapp.optin")}
									description={t("whatsapp.optin_hint")}
									selected={whatsappOptIn}
									onClick={() => setWhatsappOptIn((v) => !v)}
								/>
							</div>
						</>
					) : null}
				</motion.div>
			</AnimatePresence>
		</OnboardingShell>
	);
}

/** Terminal "activation" screen — recommends starter courses, not a dead end. */
function Activation({
	home,
}: {
	home: "/admin" | "/instructor" | "/dashboard";
}) {
	const { t } = useTranslation("onboarding");
	const navigate = useNavigate();
	const { data } = useQuery({
		queryKey: ["recommended"],
		queryFn: getRecommended,
	});
	const courses = (data?.courses ?? []).slice(0, 3);

	return (
		<div className="flex min-h-screen flex-col items-center bg-background px-6 py-12">
			<motion.div
				initial={{ scale: 0.8, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ type: "spring", stiffness: 200, damping: 16 }}
				className="flex size-16 items-center justify-center rounded-full bg-success/15 text-success"
			>
				<PartyPopper className="size-8" />
			</motion.div>
			<h1 className="mt-5 text-center font-display text-3xl tracking-tight text-foreground">
				{t("done.title")}
			</h1>
			<p className="mt-2 max-w-md text-center text-muted-foreground">
				{courses.length > 0 ? t("done.with_picks") : t("done.subtitle")}
			</p>

			{courses.length > 0 ? (
				<div className="mt-8 grid w-full max-w-4xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{courses.map((course) => (
						<PublicCourseCard key={course.id} course={course} />
					))}
				</div>
			) : null}

			<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
				<Button type="button" size="lg" onClick={() => navigate({ to: home })}>
					{t("done.cta")} <ArrowRight className="size-4" />
				</Button>
				<button
					type="button"
					onClick={() => navigate({ to: "/teachers/courses" })}
					className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
				>
					{t("done.browse")}
				</button>
			</div>
		</div>
	);
}
