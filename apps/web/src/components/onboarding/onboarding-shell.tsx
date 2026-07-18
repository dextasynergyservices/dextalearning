import { motion } from "framer-motion";
import { ChevronLeft, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

interface OnboardingShellProps {
	/** 0-based index of the current step (for the progress bar). */
	stepIndex: number;
	stepCount: number;
	/** Desktop side-panel copy. */
	asideTitle: string;
	asideSubtitle: string;
	canContinue: boolean;
	continueLabel: string;
	onContinue: () => void;
	/** Omit on the first step (no back). */
	onBack?: () => void;
	/** Omit to hide the skip affordance. */
	onSkip?: () => void;
	busy?: boolean;
	/** The animated step content (eyebrow + title + subtitle + controls). */
	children: ReactNode;
}

/**
 * Responsive onboarding frame (§8.1): a dark brand side-panel with live progress
 * on desktop, a native full-screen flow with a top progress bar on mobile. Owns
 * the chrome (progress / back / skip / continue); the wizard supplies the
 * animated step content as `children`.
 */
export function OnboardingShell({
	stepIndex,
	stepCount,
	asideTitle,
	asideSubtitle,
	canContinue,
	continueLabel,
	onContinue,
	onBack,
	onSkip,
	busy,
	children,
}: OnboardingShellProps) {
	const { t } = useTranslation("onboarding");
	const pct = Math.round(((stepIndex + 1) / stepCount) * 100);

	return (
		<div className="flex min-h-screen flex-col bg-background lg:grid lg:grid-cols-[440px_1fr]">
			{/* Desktop brand side-panel */}
			<aside className="relative hidden overflow-hidden bg-hero-bg p-10 text-white lg:flex lg:flex-col">
				<div className="-right-24 -top-24 pointer-events-none absolute size-80 rounded-full bg-brand-primary/30 blur-3xl" />
				<div className="-bottom-28 -left-20 pointer-events-none absolute size-80 rounded-full bg-brand-accent/20 blur-3xl" />
				<Logo
					className="relative text-2xl text-white"
					accentClassName="text-brand-accent"
				/>
				<div className="relative mt-auto">
					<h2 className="font-display text-3xl leading-tight tracking-tight">
						{asideTitle}
					</h2>
					<p className="mt-3 max-w-sm text-white/70">{asideSubtitle}</p>
					<div className="mt-8 flex items-center gap-3">
						<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
							<motion.div
								className="h-full rounded-full bg-brand-accent"
								initial={false}
								animate={{ width: `${pct}%` }}
								transition={{ duration: 0.3 }}
							/>
						</div>
						<span className="font-stats text-sm text-white/70">{pct}%</span>
					</div>
				</div>
			</aside>

			{/* Main column */}
			<div className="flex flex-1 flex-col">
				<header
					className="flex items-center gap-3 px-5 py-4 lg:px-10 lg:pt-8"
					style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
				>
					{onBack ? (
						<button
							type="button"
							onClick={onBack}
							aria-label={t("back")}
							className="-ml-2 flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent lg:hidden"
						>
							<ChevronLeft className="size-5" />
						</button>
					) : (
						<Logo className="text-xl text-foreground lg:hidden" />
					)}
					<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted lg:hidden">
						<motion.div
							className="h-full rounded-full bg-brand-solid"
							initial={false}
							animate={{ width: `${pct}%` }}
							transition={{ duration: 0.3 }}
						/>
					</div>
					{onSkip ? (
						<button
							type="button"
							onClick={onSkip}
							className="ml-auto text-muted-foreground text-sm transition-colors hover:text-foreground"
						>
							{t("skip")}
						</button>
					) : null}
				</header>

				<main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 pt-2 pb-6 lg:justify-center lg:pt-0">
					<div className="flex-1 lg:flex-none">{children}</div>

					<div className="pt-6 lg:pt-8">
						{onBack ? (
							<button
								type="button"
								onClick={onBack}
								className="mb-3 hidden items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground lg:inline-flex"
							>
								<ChevronLeft className="size-4" /> {t("back")}
							</button>
						) : null}
						<Button
							type="button"
							size="lg"
							disabled={!canContinue || busy}
							onClick={onContinue}
							className="w-full"
						>
							{busy ? <Loader2 className="size-4 animate-spin" /> : null}
							{continueLabel}
						</Button>
					</div>
				</main>
			</div>
		</div>
	);
}
