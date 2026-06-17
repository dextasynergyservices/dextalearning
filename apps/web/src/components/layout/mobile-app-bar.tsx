import { Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { cn } from "@/lib/utils";

interface MobileAppBarProps {
	/** Page title — when set, renders the contextual (inner-page) variant. */
	title?: string;
	/** Show a native back chevron that pops navigation history. */
	showBack?: boolean;
	/** Start transparent over a dark hero, turning solid on scroll. */
	transparent?: boolean;
}

/**
 * Native-style top app bar for mobile (blueprint §10). Hidden on lg+, where the
 * desktop utility header takes over. Respects the safe-area (notch) inset and
 * pairs with the bottom tab bar to give an app-like top/bottom chrome.
 *
 * Navigation lives in the bottom tab bar. This bar handles:
 * - Branding (logo or contextual page title)
 * - Back navigation (inner pages)
 * - Language switcher
 * - Quick Search access
 * - Notification bell (placeholder — wired in Phase 5)
 */
export function MobileAppBar({
	title,
	showBack = false,
	transparent = false,
}: MobileAppBarProps) {
	const router = useRouter();
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 8);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const onDark = transparent && !scrolled;
	const solid = scrolled || !transparent;

	const iconClass = (dark: boolean) =>
		cn(
			"flex size-10 items-center justify-center rounded-full transition-colors active:scale-95",
			dark
				? "text-white hover:bg-white/10"
				: "text-slate-600 hover:bg-slate-100",
		);

	return (
		<header
			className={cn(
				"fixed inset-x-0 top-0 z-40 transition-colors duration-300 lg:hidden",
				solid
					? "border-b border-slate-200 bg-white/90 backdrop-blur-md"
					: "border-b border-transparent",
			)}
			style={{ paddingTop: "env(safe-area-inset-top)" }}
		>
			<div className="flex h-14 items-center gap-1 px-3">
				{showBack ? (
					<button
						type="button"
						onClick={() => router.history.back()}
						aria-label="Back"
						className={cn(
							"-ml-1 flex size-10 items-center justify-center rounded-full transition-colors active:scale-95",
							onDark
								? "text-white hover:bg-white/10"
								: "text-slate-700 hover:bg-slate-100",
						)}
					>
						<ChevronLeft className="size-6" />
					</button>
				) : null}

				{title ? (
					<h1
						className={cn(
							"truncate font-display text-lg tracking-tight",
							onDark ? "text-white" : "text-slate-900",
						)}
					>
						{title}
					</h1>
				) : (
					<Logo
						className={cn("text-xl", onDark ? "text-white" : "text-slate-900")}
						accentClassName={
							onDark ? "text-brand-accent" : "text-brand-primary"
						}
					/>
				)}

				<div className="ml-auto flex items-center gap-0.5">
					<LanguageSwitcher compact onDark={onDark} />
					<Link to="/search" aria-label="Search" className={iconClass(onDark)}>
						<Search className="size-5" />
					</Link>
				</div>
			</div>
		</header>
	);
}
