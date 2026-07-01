import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
	BookOpenCheck,
	Coins,
	type LucideIcon,
	Rocket,
	Sparkles,
	Upload,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
	type InstructorOnboardingPayload,
	saveInstructorOnboarding,
} from "@/lib/content-api";
import { OnboardingShell } from "./onboarding-shell";

const STEPS = ["welcome", "profile", "orientation"] as const;

const EXPERTISE = [
	"technology",
	"business",
	"design",
	"data",
	"languages",
	"science",
	"arts",
	"health",
	"education",
	"personal",
];

const ORIENTATION: { key: string; icon: LucideIcon }[] = [
	{ key: "create", icon: Upload },
	{ key: "earn", icon: Coins },
	{ key: "publish", icon: BookOpenCheck },
];

const slide = {
	enter: (dir: number) => ({ x: dir > 0 ? 28 : -28, opacity: 0 }),
	center: { x: 0, opacity: 1 },
	exit: (dir: number) => ({ x: dir > 0 ? -28 : 28, opacity: 0 }),
};

/** Instructor onboarding (§8.1.1) — welcome + public profile + studio orientation. */
export function InstructorOnboarding() {
	const { t } = useTranslation("onboarding");
	const navigate = useNavigate();
	const [index, setIndex] = useState(0);
	const [direction, setDirection] = useState(1);
	const [headline, setHeadline] = useState("");
	const [bio, setBio] = useState("");
	const [expertise, setExpertise] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);

	const step = STEPS[index];
	const isLast = index === STEPS.length - 1;

	const go = (next: number) => {
		setDirection(next > index ? 1 : -1);
		setIndex(next);
	};

	const toggleExpertise = (area: string) =>
		setExpertise((current) =>
			current.includes(area)
				? current.filter((value) => value !== area)
				: [...current, area],
		);

	const finish = async () => {
		setSaving(true);
		const payload: InstructorOnboardingPayload = {
			headline: headline.trim() || undefined,
			bio: bio.trim() || undefined,
			expertiseAreas: expertise,
		};
		try {
			await saveInstructorOnboarding(payload);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t("save_error"));
		} finally {
			setSaving(false);
			navigate({ to: "/instructor" });
		}
	};

	return (
		<OnboardingShell
			stepIndex={index}
			stepCount={STEPS.length}
			asideTitle={t("aside.instructor_title")}
			asideSubtitle={t("aside.instructor_subtitle")}
			canContinue
			busy={saving}
			continueLabel={isLast ? t("instructor.enter_studio") : t("next")}
			onContinue={() => (isLast ? finish() : go(index + 1))}
			onBack={index > 0 ? () => go(index - 1) : undefined}
			onSkip={() => navigate({ to: "/instructor" })}
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
					{step === "welcome" ? (
						<div className="text-center sm:text-left">
							<span className="inline-flex size-14 items-center justify-center rounded-2xl bg-brand-primary-light text-brand-primary">
								<Sparkles className="size-7" />
							</span>
							<h1 className="mt-5 font-display text-2xl tracking-tight text-foreground sm:text-3xl">
								{t("instructor.welcome_title")}
							</h1>
							<p className="mt-2 text-muted-foreground">
								{t("instructor.welcome_subtitle")}
							</p>
							<div className="mt-6 space-y-3 text-left">
								{ORIENTATION.map(({ key, icon: Icon }) => (
									<div
										key={key}
										className="flex items-start gap-3 rounded-card border border-border bg-card p-4"
									>
										<span className="flex size-9 shrink-0 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
											<Icon className="size-4" />
										</span>
										<span className="text-muted-foreground text-sm">
											{t(`instructor.points.${key}`)}
										</span>
									</div>
								))}
							</div>
						</div>
					) : null}

					{step === "profile" ? (
						<>
							<h1 className="font-display text-2xl tracking-tight text-foreground sm:text-3xl">
								{t("instructor.profile_title")}
							</h1>
							<p className="mt-2 text-muted-foreground">
								{t("instructor.profile_subtitle")}
							</p>
							<div className="mt-6 space-y-4">
								<div>
									<label
										htmlFor="headline"
										className="mb-1.5 block font-medium text-foreground text-sm"
									>
										{t("instructor.headline")}
									</label>
									<input
										id="headline"
										value={headline}
										maxLength={160}
										onChange={(e) => setHeadline(e.target.value)}
										placeholder={t("instructor.headline_ph")}
										className="h-12 w-full rounded-input border border-border bg-card px-4 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-primary"
									/>
								</div>
								<div>
									<label
										htmlFor="bio"
										className="mb-1.5 block font-medium text-foreground text-sm"
									>
										{t("instructor.bio")}
									</label>
									<textarea
										id="bio"
										value={bio}
										maxLength={2000}
										rows={4}
										onChange={(e) => setBio(e.target.value)}
										placeholder={t("instructor.bio_ph")}
										className="w-full resize-none rounded-input border border-border bg-card px-4 py-3 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-primary"
									/>
								</div>
								<div>
									<p className="mb-2 font-medium text-foreground text-sm">
										{t("instructor.expertise")}
									</p>
									<div className="flex flex-wrap gap-2">
										{EXPERTISE.map((area) => {
											const selected = expertise.includes(area);
											return (
												<button
													key={area}
													type="button"
													aria-pressed={selected}
													onClick={() => toggleExpertise(area)}
													className={
														selected
															? "rounded-pill border border-brand-primary bg-brand-primary-light px-3.5 py-1.5 font-medium text-brand-primary text-sm transition-all active:scale-95"
															: "rounded-pill border border-border px-3.5 py-1.5 font-medium text-muted-foreground text-sm transition-all hover:border-brand-primary/40 active:scale-95"
													}
												>
													{t(`instructor.areas.${area}`)}
												</button>
											);
										})}
									</div>
								</div>
							</div>
						</>
					) : null}

					{step === "orientation" ? (
						<div className="text-center sm:text-left">
							<span className="inline-flex size-14 items-center justify-center rounded-2xl bg-success/15 text-success">
								<Rocket className="size-7" />
							</span>
							<h1 className="mt-5 font-display text-2xl tracking-tight text-foreground sm:text-3xl">
								{t("instructor.ready_title")}
							</h1>
							<p className="mt-2 text-muted-foreground">
								{t("instructor.ready_subtitle")}
							</p>
							<p className="mt-4 rounded-card border border-border border-dashed bg-muted/50 p-4 text-left text-muted-foreground text-sm">
								{t("instructor.payout_note")}
							</p>
						</div>
					) : null}
				</motion.div>
			</AnimatePresence>
		</OnboardingShell>
	);
}
