import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { MotionConfig } from "framer-motion";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundaryFallback } from "./components/layout/error-boundary-fallback";
import { ThemedToaster } from "./components/ui/themed-toaster";
import "./lib/fonts";
import "./index.css";
import "lenis/dist/lenis.css";
import * as Sentry from "@sentry/react";
import { toast } from "sonner";
import { useSession } from "./lib/auth-client";
import i18n, { i18nReady } from "./lib/i18n";
import {
	identifyUser,
	initObservability,
	trackPageView,
} from "./lib/observability";
import { registerPWA } from "./lib/pwa";
import { routeTree } from "./routeTree.gen";

// Before anything renders, so the very first error is already caught. No-op
// without VITE_SENTRY_DSN / VITE_POSTHOG_KEY (§15).
initObservability();

// PWA (§6.1): offline shell + background sync. Production-only; when a new
// version is waiting, offer a reload rather than yanking chunks mid-session.
registerPWA((activate) => {
	toast(i18n.t("common:pwa.update_available", "A new version is ready."), {
		duration: Infinity,
		action: {
			label: i18n.t("common:pwa.reload", "Reload"),
			onClick: activate,
		},
	});
});

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 60_000,
			retry: 1,
			// Refetch when the user comes back to the tab or the network returns.
			// Without this, a dashboard left open showed whatever it loaded an hour
			// ago and only a manual page refresh fixed it — which is exactly what
			// people were doing. `staleTime` still gates it, so coming back inside a
			// minute costs nothing: this refetches on focus only when data is stale.
			refetchOnWindowFocus: true,
			refetchOnReconnect: true,
		},
	},
});

const router = createRouter({
	routeTree,
	context: { queryClient },
	defaultPreload: "intent",
	scrollRestoration: true,
	// Cross-fade route changes via the View Transitions API for a native-app
	// feel (disabled automatically under prefers-reduced-motion, see index.css).
	defaultViewTransition: true,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

// SPA pageviews: the automatic capture only sees full page loads, so the
// router reports every client-side navigation (and re-applies the proctored-
// route replay opt-out) — see lib/observability.ts.
router.subscribe("onResolved", ({ toLocation }) => {
	trackPageView(toLocation.pathname);
});

/**
 * Ties Sentry + PostHog to the signed-in user (distinct_id = our user id, the
 * join that lets funnels span client and server events). Renders nothing.
 */
function ObservabilityUser() {
	const { data: session } = useSession();
	const user = session?.user as { id: string; role?: string } | undefined;
	const id = user?.id ?? null;
	const role = user?.role;
	useEffect(() => {
		identifyUser(id ? { id, role } : null);
	}, [id, role]);
	return null;
}

const rootElement = document.getElementById("root");

if (!rootElement) {
	throw new Error("Root element #root was not found.");
}

// Locales are lazy chunks now (§13.2) — hold the first render until the
// detected language has landed, so no raw translation key ever paints.
// Top-level await: Vite targets ES2022+.
await i18nReady;

createRoot(rootElement).render(
	<StrictMode>
		{/* Last-resort catch: a render crash shows a localized recover screen
		    (and reports to Sentry) instead of a permanent white page. */}
		<Sentry.ErrorBoundary
			fallback={({ resetError }) => (
				<ErrorBoundaryFallback onRetry={resetError} />
			)}
		>
			<MotionConfig reducedMotion="user">
				<QueryClientProvider client={queryClient}>
					<ObservabilityUser />
					<RouterProvider router={router} />
					<ThemedToaster />
				</QueryClientProvider>
			</MotionConfig>
		</Sentry.ErrorBoundary>
	</StrictMode>,
);
