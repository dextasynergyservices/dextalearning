import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
	ArrowRight,
	MessagesSquare,
	Quote,
	Sparkles,
	UsersRound,
} from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { PublicShell } from "@/components/layout/public-shell";
import { buttonVariants } from "@/components/ui/button";
import { useReveal } from "@/hooks/use-reveal";

export const Route = createFileRoute("/community")({
	component: CommunityPage,
});

// Illustrative learner voices (stand-in for API content).
const VOICES = [
	{
		name: "Chinwe A.",
		role: "Primary teacher, Enugu",
		quote:
			"My cohort group became my staffroom away from school. We pushed each other to finish.",
	},
	{
		name: "Yusuf M.",
		role: "Maths teacher, Kano",
		quote:
			"Seeing other teachers' progress made me want to keep my streak alive. It's friendly competition.",
	},
	{
		name: "Blessing T.",
		role: "Head teacher, Abuja",
		quote:
			"I brought three colleagues in. Now we plan lessons using what we learned together.",
	},
];

const ENGAGE: { key: string; icon: ComponentType<{ className?: string }> }[] = [
	{ key: "cohorts", icon: UsersRound },
	{ key: "groups", icon: MessagesSquare },
	{ key: "share", icon: Sparkles },
];

function CommunityPage() {
	const { t } = useTranslation("content");
	const voicesRef = useReveal<HTMLElement>();
	const engageRef = useReveal<HTMLElement>();
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
						{t("community.badge")}
					</motion.span>
					<motion.h1
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.05 }}
						className="font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl"
					>
						{t("community.title")}
					</motion.h1>
					<motion.p
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.15 }}
						className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground"
					>
						{t("community.subtitle")}
					</motion.p>
				</div>
			</section>

			{/* Voices */}
			<section
				ref={voicesRef}
				className="mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-20"
			>
				<h2
					data-reveal
					className="text-center font-display text-2xl tracking-tight text-foreground sm:text-3xl"
				>
					{t("community.voices_title")}
				</h2>
				<div className="mt-10 grid gap-6 lg:grid-cols-3">
					{VOICES.map((voice, idx) => (
						<figure
							key={voice.name}
							data-reveal={idx % 2 === 0 ? "left" : "right"}
							className="flex flex-col rounded-card border border-border bg-card p-7 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
						>
							<Quote className="size-7 text-brand-accent" />
							<blockquote className="mt-4 flex-1 text-foreground">
								"{voice.quote}"
							</blockquote>
							<figcaption className="mt-6 flex items-center gap-3">
								<span className="flex size-10 items-center justify-center rounded-full bg-brand-primary-light font-display text-brand-primary">
									{voice.name.charAt(0)}
								</span>
								<div>
									<p className="font-semibold text-foreground">{voice.name}</p>
									<p className="text-muted-foreground text-sm">{voice.role}</p>
								</div>
							</figcaption>
						</figure>
					))}
				</div>
			</section>

			{/* Ways to engage */}
			<section ref={engageRef} className="bg-muted">
				<div className="mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-20">
					<h2
						data-reveal
						className="text-center font-display text-2xl tracking-tight text-foreground sm:text-3xl"
					>
						{t("community.engage_title")}
					</h2>
					<div className="mt-10 grid gap-6 sm:grid-cols-3">
						{ENGAGE.map(({ key, icon: Icon }) => (
							<div
								key={key}
								data-reveal="scale"
								className="rounded-card border border-border bg-card p-7 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
							>
								<span className="flex size-12 items-center justify-center rounded-btn bg-brand-accent-light text-amber-700">
									<Icon className="size-6" />
								</span>
								<h3 className="mt-5 font-display text-lg text-foreground">
									{t(`community.engage.${key}.title`)}
								</h3>
								<p className="mt-2 text-muted-foreground text-sm leading-relaxed">
									{t(`community.engage.${key}.body`)}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* CTA */}
			<section ref={ctaRef} className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
				<div
					data-reveal="scale"
					className="rounded-card bg-brand-primary px-8 py-16 text-center text-white shadow-card lg:py-20"
				>
					<h2 className="font-display text-3xl tracking-tight sm:text-4xl">
						{t("community.cta_title")}
					</h2>
					<p className="mx-auto mt-4 max-w-xl text-blue-100">
						{t("community.cta_body")}
					</p>
					<div className="mt-8 flex justify-center">
						<Link
							to="/register"
							className={buttonVariants({ variant: "accent", size: "lg" })}
						>
							{t("community.cta_button")} <ArrowRight className="size-4" />
						</Link>
					</div>
				</div>
			</section>
		</PublicShell>
	);
}
