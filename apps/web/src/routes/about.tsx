import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Flag, Globe, Microscope } from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { PublicShell } from "@/components/layout/public-shell";
import { ContactSection } from "@/components/marketing/contact-section";
import { buttonVariants } from "@/components/ui/button";
import { useCountUp } from "@/hooks/use-count-up";
import { useReveal } from "@/hooks/use-reveal";

export const Route = createFileRoute("/about")({ component: AboutPage });

const BELIEFS: { key: string; icon: ComponentType<{ className?: string }> }[] =
	[
		{ key: "science", icon: Microscope },
		{ key: "finish", icon: Flag },
		{ key: "access", icon: Globe },
	];

const STAT_KEYS = ["completion", "learners", "languages", "lessons"];

function Stat({ value, label }: { value: string; label: string }) {
	const numMatch = value.match(/^([\d.]+)(.*)$/);
	const num = numMatch ? parseFloat(numMatch[1]) : 0;
	const suffix = numMatch ? numMatch[2] : "";
	const decimals = value.includes(".") ? 1 : 0;

	const { ref, display } = useCountUp(num, { suffix, decimals });

	return (
		<div className="text-center">
			<p
				ref={ref as React.RefObject<HTMLParagraphElement>}
				className="font-stats font-bold text-4xl text-brand-accent sm:text-5xl"
			>
				{display}
			</p>
			<p className="mt-2 text-muted-foreground text-sm">{label}</p>
		</div>
	);
}

function AboutPage() {
	const { t } = useTranslation("content");
	const missionRef = useReveal<HTMLElement>();
	const beliefsRef = useReveal<HTMLElement>();
	const statsRef = useReveal<HTMLElement>();
	const ctaRef = useReveal<HTMLElement>();

	return (
		<PublicShell darkHeader>
			{/* Hero */}
			<section className="relative overflow-hidden bg-hero-bg text-white">
				<div className="relative mx-auto max-w-4xl px-6 pt-24 pb-14 text-center lg:pt-32 lg:pb-20">
					<motion.span
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5 }}
						className="badge-earnback mb-5 bg-white/10 text-brand-accent"
					>
						{t("about.badge")}
					</motion.span>
					<motion.h1
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.05 }}
						className="font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl"
					>
						{t("about.title")}
					</motion.h1>
					<motion.p
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.15 }}
						className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground"
					>
						{t("about.subtitle")}
					</motion.p>
				</div>
			</section>

			{/* Mission */}
			<section
				ref={missionRef}
				className="mx-auto max-w-3xl px-6 py-14 text-center lg:py-20"
			>
				<p
					data-reveal="scale"
					className="font-stats font-semibold text-brand-primary text-sm uppercase tracking-wider"
				>
					{t("about.mission_title")}
				</p>
				<p
					data-reveal
					className="mt-4 font-display text-2xl text-foreground leading-snug sm:text-3xl"
				>
					{t("about.mission_body")}
				</p>
			</section>

			{/* Beliefs */}
			<section ref={beliefsRef} className="bg-muted">
				<div className="mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-20">
					<h2
						data-reveal
						className="text-center font-display text-2xl tracking-tight text-foreground sm:text-3xl"
					>
						{t("about.beliefs_title")}
					</h2>
					<div className="mt-10 grid gap-6 sm:grid-cols-3">
						{BELIEFS.map(({ key, icon: Icon }, idx) => (
							<div
								key={key}
								data-reveal={idx % 2 === 0 ? "left" : "right"}
								className="rounded-card border border-border bg-card p-7 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
							>
								<span className="flex size-12 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
									<Icon className="size-6" />
								</span>
								<h3 className="mt-5 font-display text-lg text-foreground">
									{t(`about.beliefs.${key}.title`)}
								</h3>
								<p className="mt-2 text-muted-foreground text-sm leading-relaxed">
									{t(`about.beliefs.${key}.body`)}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Stats */}
			<section
				ref={statsRef}
				className="relative overflow-hidden bg-hero-bg text-white"
			>
				<div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
					{STAT_KEYS.map((key) => (
						<Stat
							key={key}
							value={t(`about.stats.${key}.value`)}
							label={t(`about.stats.${key}.label`)}
						/>
					))}
				</div>
			</section>

			{/* Contact + socials (also deep-linked from the mobile More menu) */}
			<ContactSection />

			{/* CTA */}
			<section ref={ctaRef} className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
				<div
					data-reveal="scale"
					className="rounded-card bg-brand-solid px-8 py-16 text-center text-white shadow-card lg:py-20"
				>
					<h2 className="font-display text-3xl tracking-tight sm:text-4xl">
						{t("about.cta_title")}
					</h2>
					<p className="mx-auto mt-4 max-w-xl text-blue-100">
						{t("about.cta_body")}
					</p>
					<div className="mt-8 flex justify-center">
						<Link
							to="/register"
							className={buttonVariants({ variant: "accent", size: "lg" })}
						>
							{t("about.cta_button")} <ArrowRight className="size-4" />
						</Link>
					</div>
				</div>
			</section>
		</PublicShell>
	);
}
