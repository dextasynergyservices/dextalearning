import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { MobileAppBar } from "@/components/layout/mobile-app-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { cn } from "@/lib/utils";

interface PublicShellProps {
	children: ReactNode;
	/** Dark hero pages: desktop + mobile bars start transparent over the hero. */
	darkHeader?: boolean;
	/** Inner-page mobile app bar title (renders the contextual variant). */
	mobileTitle?: string;
	/** Show a back chevron in the mobile app bar. */
	mobileShowBack?: boolean;
	/** Keep native mobile learner flows focused; desktop still gets the footer. */
	hideFooterOnMobile?: boolean;
}

/**
 * Chrome for all public/marketing pages: desktop utility header, native mobile
 * app bar (top) + bottom tab bar, footer, and an app-like page-enter transition.
 * Content is inset for the fixed bars and safe-area insets.
 */
export function PublicShell({
	children,
	darkHeader = false,
	mobileTitle,
	mobileShowBack = false,
}: PublicShellProps) {
	const solidMobileBar = Boolean(mobileTitle);

	return (
		<div className="flex min-h-screen flex-col bg-white">
			<SiteHeader dark={darkHeader} />
			<MobileAppBar
				title={mobileTitle}
				showBack={mobileShowBack}
				transparent={darkHeader && !solidMobileBar}
			/>

			<motion.main
				initial={{ opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
				className={cn(
					"flex-1 pb-20 lg:pb-0",
					solidMobileBar &&
						"pt-[calc(3.5rem+env(safe-area-inset-top))] lg:pt-0",
				)}
			>
				{children}
			</motion.main>

			{/* Footer is desktop-only; mobile uses the bottom tab bar + More sheet. */}
			<div className="hidden lg:block">
				<SiteFooter />
			</div>
			<BottomTabBar />
		</div>
	);
}
