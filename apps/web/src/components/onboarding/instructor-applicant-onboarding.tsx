import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, ClipboardCheck, Clock, Compass } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
	type InstructorOnboardingPayload,
	saveInstructorOnboarding,
} from "@/lib/content-api";
import { LearnerOnboarding } from "./learner-onboarding";
import { OnboardingShell } from "./onboarding-shell";

const STEPS = ["welcome", "profile", "waiting"] as const;

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

const slide = {
	enter: (dir: number) => ({ x: dir > 0 ? 28 : -28, opacity: 0 }),
	center: { x: 0, opacity: 1 },
	exit: (dir: number) => ({ x: dir > 0 ? -28 : 28, opacity: 0 }),
};

/**
 * Onboarding for someone whose instructor application is PENDING (§8.1.1).
 *
 * Two jobs, in this order. First collect the profile an admin actually reviews —
 * without it they'd be judging a name and an email, so this step is required.
 * Then hand the applicant over to the learner experience, because the promise we
 * make is "keep learning while you wait", and it has to be true. It ends on the
 * learner dashboard, never the studio: the studio isn't theirs yet.
 */
export function InstructorApplicantOnboarding() {
	const { t } = useTranslation("onboarding");
	const navigate = useNavigate();
	const [index, setIndex] = useState(0);
	const [direction, setDirection] = useState(1);
	const [headline, setHeadline] = useState("");
	const [bio, setBio] = useState("");
	const [expertise, setExpertise] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	// Set once they choose to carry on into learner preferences; the learner flow
	// owns its own steps and exit, so we simply hand over to it.
	const [settingUpLearning, setSettingUpLearning] = useState(false);

	const step = STEPS[index];

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

	/** Save the application profile, then move on to the waiting step. */
	const saveProfile = async () => {
		setSaving(true);
		const payload: InstructorOnboardingPayload = {
			headline: headline.trim() || undefined,
			bio: bio.trim() || undefined,
			expertiseAreas: expertise,
		};
		try {
			await saveInstructorOnboarding(payload);
			go(index + 1);
		} catch (error) {
			// Don't advance on failure — the admin would get an empty application.
			toast.error(error instanceof Error ? error.message : t("save_error"));
		} finally {
			setSaving(false);
		}
	};

	// A headline is the one thing that makes an application reviewable.
	const canContinue =
		step !== "profile" ? true : headline.trim().length > 0 && !saving;

	const onContinue = () => {
		if (step === "profile") return void saveProfile();
		if (step === "waiting") return setSettingUpLearning(true);
		go(index + 1);
	};

	// The application is filed; the rest of onboarding is just the learner flow,
	// which already knows how to collect preferences and where to exit.
	if (settingUpLearning) return <LearnerOnboarding />;

	return (
		<OnboardingShell
			stepIndex={index}
			stepCount={STEPS.length}
			asideTitle={t("aside.applicant_title")}
			asideSubtitle={t("aside.applicant_subtitle")}
			canContinue={canContinue}
			busy={saving}
			continueLabel={
				step === "waiting"
					? t("applicant.set_up_learning")
					: step === "profile"
						? t("applicant.submit")
						: t("next")
			}
			onContinue={onContinue}
			onBack={index > 0 && step !== "waiting" ? () => go(index - 1) : undefined}
			// Skipping is only offered once the application itself is in.
			onSkip={
				step === "waiting" ? () => navigate({ to: "/dashboard" }) : undefined
			}
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
								<ClipboardCheck className="size-7" />
							</span>
							<h1 className="mt-5 font-display text-2xl tracking-tight text-foreground sm:text-3xl">
								{t("applicant.welcome_title")}
							</h1>
							<p className="mt-2 text-muted-foreground">
								{t("applicant.welcome_subtitle")}
							</p>
							<div className="mt-6 space-y-3 text-left">
								{[
									{ key: "review", icon: ClipboardCheck },
									{ key: "notified", icon: Clock },
									{ key: "meanwhile", icon: BookOpen },
								].map(({ key, icon: Icon }) => (
									<div
										key={key}
										className="flex items-start gap-3 rounded-card border border-border bg-card p-4"
									>
										<span className="flex size-9 shrink-0 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
											<Icon className="size-4" />
										</span>
										<span className="text-muted-foreground text-sm">
											{t(`applicant.points.${key}`)}
										</span>
									</div>
								))}
							</div>
						</div>
					) : null}

					{step === "profile" ? (
						<>
							<h1 className="font-display text-2xl tracking-tight text-foreground sm:text-3xl">
								{t("applicant.profile_title")}
							</h1>
							<p className="mt-2 text-muted-foreground">
								{t("applicant.profile_subtitle")}
							</p>
							<div className="mt-6 space-y-4">
								<div>
									<label
										htmlFor="headline"
										className="mb-1.5 block font-medium text-foreground text-sm"
									>
										{t("applicant.headline")}
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
										{t("applicant.bio")}
									</label>
									<textarea
										id="bio"
										value={bio}
										maxLength={2000}
										rows={4}
										onChange={(e) => setBio(e.target.value)}
										placeholder={t("applicant.bio_ph")}
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

					{step === "waiting" ? (
						<div className="text-center sm:text-left">
							<span className="inline-flex size-14 items-center justify-center rounded-2xl bg-warning/15 text-amber-600 dark:text-amber-300">
								<Clock className="size-7" />
							</span>
							<h1 className="mt-5 font-display text-2xl tracking-tight text-foreground sm:text-3xl">
								{t("applicant.waiting_title")}
							</h1>
							<p className="mt-2 text-muted-foreground">
								{t("applicant.waiting_subtitle")}
							</p>
							<div className="mt-6 flex items-start gap-3 rounded-card border border-brand-primary/20 bg-brand-primary-light/30 p-4 text-left">
								<Compass className="mt-0.5 size-5 shrink-0 text-brand-primary" />
								<p className="text-muted-foreground text-sm">
									{t("applicant.meanwhile_note")}
								</p>
							</div>
						</div>
					) : null}
				</motion.div>
			</AnimatePresence>
		</OnboardingShell>
	);
}
