import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/brand/logo";
import { AccountMenu } from "@/components/layout/account-menu";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { buttonVariants } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
	{ to: "/teachers/courses", key: "courses" },
	{ to: "/teachers/paths", key: "paths" },
	{ to: "/teachers/cohorts", key: "cohorts" },
	{ to: "/about", key: "about" },
	{ to: "/blog", key: "blog" },
	{ to: "/community", key: "community" },
] as const;

/**
 * Desktop utility/nav bar (blueprint §9.5 — "Utility bar desktop-only"). Hidden
 * below lg, where the bottom tab bar handles navigation. Turns solid on scroll.
 */
export function SiteHeader({ dark = false }: { dark?: boolean }) {
	const { t } = useTranslation("common");
	const { data: session } = useSession();
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 16);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const onDark = dark && !scrolled;

	return (
		<header
			className={cn(
				"fixed inset-x-0 top-0 z-50 hidden transition-colors duration-300 lg:block",
				scrolled
					? "border-b border-border bg-card/90 backdrop-blur-md"
					: "border-b border-transparent",
			)}
		>
			<div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-8">
				<Logo
					accentClassName={onDark ? "text-brand-accent" : "text-brand-primary"}
					className={onDark ? "text-white" : "text-foreground"}
				/>

				<nav aria-label="Primary" className="flex items-center gap-1">
					{NAV_LINKS.map(({ to, key }) => (
						<Link
							key={to}
							to={to}
							className={cn(
								"rounded-btn px-3.5 py-2 text-sm font-medium transition-colors",
								onDark
									? "text-slate-200 hover:bg-white/10 hover:text-white"
									: "text-muted-foreground hover:bg-accent hover:text-foreground",
							)}
							activeProps={{
								className: onDark ? "text-white" : "text-brand-primary",
							}}
						>
							{t(`nav.${key}`)}
						</Link>
					))}
				</nav>

				<div className="flex items-center gap-2">
					<LanguageSwitcher />
					{session ? (
						<AccountMenu onDark={onDark} />
					) : (
						<>
							<Link
								to="/login"
								className={cn(
									buttonVariants({ variant: "ghost", size: "sm" }),
									onDark && "text-white hover:bg-white/10",
								)}
							>
								{t("actions.sign_in")}
							</Link>
							<Link
								to="/register"
								className={buttonVariants({ variant: "primary", size: "sm" })}
							>
								{t("actions.get_started")}
							</Link>
						</>
					)}
				</div>
			</div>
		</header>
	);
}
