import { Link } from "@tanstack/react-router";
import { LifeBuoy, Mail, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
	FacebookIcon,
	InstagramIcon,
	LinkedinIcon,
	XIcon,
	YoutubeIcon,
} from "@/components/brand/social-icons";
import { cn } from "@/lib/utils";

const SOCIALS = [
	{ href: "https://facebook.com", label: "Facebook", icon: FacebookIcon },
	{ href: "https://instagram.com", label: "Instagram", icon: InstagramIcon },
	{ href: "https://x.com", label: "X (Twitter)", icon: XIcon },
	{ href: "https://linkedin.com", label: "LinkedIn", icon: LinkedinIcon },
	{ href: "https://youtube.com", label: "YouTube", icon: YoutubeIcon },
] as const;

/**
 * Reusable "Contact / get in touch" section (mobile-first). Anchorable via
 * `#contact` so the bottom-nav More menu can deep-link to it. Holds the social
 * icons (moved off the mobile footer) + the ways to reach the team.
 */
export function ContactSection({ className }: { className?: string }) {
	const { t } = useTranslation("content");
	const email = t("contact.email");

	const cards = [
		{
			icon: Mail,
			label: t("contact.email_label"),
			value: email,
			href: `mailto:${email}`,
		},
		{
			icon: UsersRound,
			label: t("contact.community_label"),
			value: t("contact.community_desc"),
			to: "/community" as const,
		},
		{
			icon: LifeBuoy,
			label: t("contact.support_label"),
			value: t("contact.support_desc"),
			href: `mailto:${email}`,
		},
	];

	return (
		<section
			id="contact"
			className={cn("scroll-mt-24 bg-muted py-14 lg:py-20", className)}
		>
			<div className="mx-auto max-w-5xl px-6 lg:px-8">
				<div className="text-center">
					<p className="font-stats font-semibold text-brand-primary text-xs uppercase tracking-wider">
						{t("contact.eyebrow")}
					</p>
					<h2 className="mt-2 font-display text-3xl text-foreground tracking-tight sm:text-4xl">
						{t("contact.title")}
					</h2>
					<p className="mx-auto mt-3 max-w-xl text-muted-foreground">
						{t("contact.subtitle")}
					</p>
				</div>

				<div className="mt-10 grid gap-4 sm:grid-cols-3">
					{cards.map((card) => {
						const inner = (
							<>
								<span className="flex size-11 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary transition-colors group-hover:bg-brand-solid-hover group-hover:text-white">
									<card.icon className="size-5" />
								</span>
								<p className="mt-4 font-display text-foreground">
									{card.label}
								</p>
								<p className="mt-1 break-words text-muted-foreground text-sm">
									{card.value}
								</p>
							</>
						);
						const cls =
							"group flex flex-col rounded-card border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-1 hover:border-brand-primary/30 hover:shadow-card-hover";
						return "to" in card && card.to ? (
							<Link key={card.label} to={card.to} className={cls}>
								{inner}
							</Link>
						) : (
							<a key={card.label} href={card.href} className={cls}>
								{inner}
							</a>
						);
					})}
				</div>

				<div className="mt-10 flex flex-col items-center gap-3">
					<p className="font-stats font-semibold text-muted-foreground text-xs uppercase tracking-wider">
						{t("contact.follow")}
					</p>
					<div className="flex items-center gap-2">
						{SOCIALS.map(({ href, label, icon: Icon }) => (
							<a
								key={label}
								href={href}
								target="_blank"
								rel="noreferrer"
								aria-label={label}
								className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-brand-primary hover:text-brand-primary"
							>
								<Icon className="size-4" />
							</a>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
