import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/brand/logo";
import {
	FacebookIcon,
	InstagramIcon,
	LinkedinIcon,
	XIcon,
	YoutubeIcon,
} from "@/components/brand/social-icons";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getAcademies } from "@/lib/content-api";
import { useAcademyParam } from "@/lib/use-current-academy";

/** The global (academy-agnostic) footer columns. The academy-scoped "Learn"
 *  column is built dynamically — see `useLearnLinks`. */
const GLOBAL_COLUMNS: {
	titleKey: string;
	links: {
		to: "/about" | "/blog" | "/community" | "/login" | "/register";
		labelKey: string;
	}[];
}[] = [
	{
		titleKey: "footer.company",
		links: [
			{ to: "/about", labelKey: "nav.about" },
			{ to: "/blog", labelKey: "nav.blog" },
			{ to: "/community", labelKey: "nav.community" },
		],
	},
	{
		titleKey: "footer.account",
		links: [
			{ to: "/login", labelKey: "actions.sign_in" },
			{ to: "/register", labelKey: "actions.create_account" },
		],
	},
];

const LINK_CLASS =
	"text-muted-foreground text-sm transition-colors hover:text-brand-primary";

/**
 * The "Learn" links, academy-aware like the header/tab bar: inside an academy →
 * that academy's Courses/Paths/Cohorts; on global pages → the academies
 * themselves (never a silent default). Plus cross-academy Search.
 */
function useLearnLinks(): { key: string; el: ReactNode }[] {
	const { t } = useTranslation("common");
	const academy = useAcademyParam();
	const { data: academies } = useQuery({
		queryKey: ["academies"],
		queryFn: getAcademies,
		staleTime: 5 * 60 * 1000,
	});

	const search = {
		key: "search",
		el: (
			<Link to="/search" className={LINK_CLASS}>
				{t("tabs.search")}
			</Link>
		),
	};

	if (academy) {
		return [
			{
				key: "courses",
				el: (
					<Link
						to="/$academy/courses"
						params={{ academy }}
						className={LINK_CLASS}
					>
						{t("nav.courses")}
					</Link>
				),
			},
			{
				key: "paths",
				el: (
					<Link
						to="/$academy/paths"
						params={{ academy }}
						className={LINK_CLASS}
					>
						{t("footer.learning_paths")}
					</Link>
				),
			},
			{
				key: "cohorts",
				el: (
					<Link
						to="/$academy/cohorts"
						params={{ academy }}
						className={LINK_CLASS}
					>
						{t("nav.cohorts")}
					</Link>
				),
			},
			search,
		];
	}

	return [
		...(academies ?? []).map((a) => ({
			key: a.slug,
			el: (
				<Link
					to="/$academy"
					params={{ academy: a.slug }}
					className={LINK_CLASS}
				>
					{a.name}
				</Link>
			),
		})),
		search,
	];
}

const SOCIALS = [
	{ href: "https://facebook.com", label: "Facebook", icon: FacebookIcon },
	{ href: "https://instagram.com", label: "Instagram", icon: InstagramIcon },
	{ href: "https://x.com", label: "X (Twitter)", icon: XIcon },
	{ href: "https://linkedin.com", label: "LinkedIn", icon: LinkedinIcon },
	{ href: "https://youtube.com", label: "YouTube", icon: YoutubeIcon },
] as const;

function SocialLinks() {
	return (
		<div className="flex items-center gap-2">
			{SOCIALS.map(({ href, label, icon: Icon }) => (
				<a
					key={label}
					href={href}
					target="_blank"
					rel="noreferrer"
					aria-label={label}
					className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand-primary hover:text-brand-primary"
				>
					<Icon className="size-4" />
				</a>
			))}
		</div>
	);
}

export function SiteFooter() {
	const { t } = useTranslation("common");
	const academy = useAcademyParam();
	const learnLinks = useLearnLinks();
	const year = new Date().getFullYear();

	return (
		<footer className="border-border border-t bg-muted">
			{/* Desktop — full footer */}
			<div className="hidden lg:block">
				<div className="mx-auto grid max-w-7xl grid-cols-5 gap-10 px-8 py-14">
					<div className="col-span-2">
						<Logo className="text-foreground" />
						<p className="mt-4 max-w-xs text-muted-foreground text-sm">
							{t("footer.tagline")}
						</p>
						<div className="mt-6">
							<SocialLinks />
						</div>
					</div>

					<div>
						<h3 className="font-stats font-semibold text-muted-foreground text-xs uppercase tracking-wider">
							{academy
								? t("footer.learn")
								: t("nav.academies", { defaultValue: "Academies" })}
						</h3>
						<ul className="mt-4 space-y-3">
							{learnLinks.map((link) => (
								<li key={link.key}>{link.el}</li>
							))}
						</ul>
					</div>

					{GLOBAL_COLUMNS.map((column) => (
						<div key={column.titleKey}>
							<h3 className="font-stats font-semibold text-muted-foreground text-xs uppercase tracking-wider">
								{t(column.titleKey)}
							</h3>
							<ul className="mt-4 space-y-3">
								{column.links.map((link) => (
									<li key={link.to}>
										<Link to={link.to} className={LINK_CLASS}>
											{t(link.labelKey)}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>

				<div className="border-border border-t">
					<div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-6 text-muted-foreground text-sm">
						<p>
							© {year} DextaLearning. {t("footer.rights")}
						</p>
						<LanguageSwitcher />
					</div>
				</div>
			</div>

			{/* Mobile — slim footer (bottom tab bar handles primary nav) */}
			<div className="px-6 pt-8 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:hidden">
				<Logo className="text-foreground" />
				<div className="mt-4">
					<SocialLinks />
				</div>
				<nav className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
					{/* Academy catalogue only when inside an academy; the tab bar's
					    Academies sheet covers the global case. */}
					{academy ? (
						<Link
							to="/$academy/courses"
							params={{ academy }}
							className={LINK_CLASS}
						>
							{t("nav.courses")}
						</Link>
					) : null}
					<Link to="/about" className={LINK_CLASS}>
						{t("nav.about")}
					</Link>
					<Link to="/blog" className={LINK_CLASS}>
						{t("nav.blog")}
					</Link>
					<Link to="/community" className={LINK_CLASS}>
						{t("nav.community")}
					</Link>
				</nav>
				<div className="mt-6 flex items-center justify-between border-border border-t pt-4">
					<p className="text-muted-foreground text-xs">
						© {year} DextaLearning
					</p>
					<LanguageSwitcher compact />
				</div>
			</div>
		</footer>
	);
}
