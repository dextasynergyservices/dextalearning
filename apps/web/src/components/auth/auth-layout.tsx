import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

const BRAND_BULLETS = ["recall", "earnback", "cohorts"];

interface AuthLayoutProps {
	title: string;
	subtitle?: string;
	children: ReactNode;
}

/**
 * Focused, native-feeling auth chrome: a brand panel on desktop and a clean
 * single column on mobile (back-to-home + language). No bottom tab bar — auth
 * is a focused flow.
 */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
	const { t } = useTranslation(["common", "landing"]);

	return (
		<div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
			{/* Brand panel — desktop only */}
			<aside className="hidden bg-hero-bg p-12 text-white lg:flex lg:flex-col lg:justify-between">
				<Link to="/" className="inline-flex">
					<Logo
						asLink={false}
						className="text-white"
						accentClassName="text-brand-accent"
					/>
				</Link>
				<div>
					<h2 className="max-w-sm font-display text-4xl leading-tight">
						{t("common:tagline")}
					</h2>
					<ul className="mt-8 space-y-3">
						{BRAND_BULLETS.map((bullet) => (
							<li
								key={bullet}
								className="flex items-center gap-3 text-slate-200"
							>
								<Check className="size-5 text-brand-accent" />
								{t(`landing:principles.items.${bullet}.title`)}
							</li>
						))}
					</ul>
				</div>
				<p className="text-sm text-white/70">
					© {new Date().getFullYear()} DextaLearning
				</p>
			</aside>

			{/* Form side */}
			<div className="flex min-h-screen flex-col">
				<header
					className="flex items-center justify-between px-5 py-4"
					style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
				>
					{/* No aria-label: the Logo's visible text IS the accessible name.
					    An "Home" aria-label tripped WCAG 2.5.3 (label-in-name) — the
					    spoken name must contain the visible label. The chevron is
					    decorative. */}
					<Link
						to="/"
						className="flex items-center gap-1 text-foreground transition-colors hover:text-brand-primary lg:hidden"
					>
						<ChevronLeft aria-hidden className="size-5" />
						<Logo asLink={false} className="text-lg text-foreground" />
					</Link>
					<span className="hidden lg:block" />
					<LanguageSwitcher compact />
				</header>

				{/* A page needs exactly one <main> landmark (§13.1 / WCAG 1.3.1);
				    the auth pages had none. */}
				<motion.main
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
					className="flex flex-1 items-start justify-center px-6 pb-12 lg:items-center"
				>
					<div className="w-full max-w-md">
						<h1 className="font-display text-3xl tracking-tight text-foreground">
							{title}
						</h1>
						{subtitle ? (
							<p className="mt-2 text-muted-foreground">{subtitle}</p>
						) : null}
						<div className="mt-7">{children}</div>
					</div>
				</motion.main>
			</div>
		</div>
	);
}
