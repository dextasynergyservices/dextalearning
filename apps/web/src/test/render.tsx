import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";

function withCommonProviders(ui: ReactElement) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return (
		<QueryClientProvider client={queryClient}>
			<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
		</QueryClientProvider>
	);
}

/**
 * Renders a standalone component wrapped in the providers most components
 * need: `QueryClientProvider` (fresh client per call, no retries) and the
 * app's **real** configured i18n instance (all 4 languages' real resources
 * are already bundled eagerly — asserting on actual translated copy, not
 * raw keys, matches how every other test layer in this project works).
 *
 * Components that also need routing (`useNavigate`, `Link`) should use
 * `renderWithRouter` instead — wrapping everything in a router by default
 * would make route matching's async resolution leak into every simple test.
 */
export function renderWithProviders(ui: ReactElement) {
	return render(withCommonProviders(ui));
}

/**
 * Like `renderWithProviders`, but also wraps in a minimal single-route router
 * so `Link`/`useNavigate` resolve. For components that merely need router
 * *context* (not for testing an actual file-route's own search-param
 * validation/loader — use `renderRoute` for that, see ./render-route.tsx).
 * Route matching is async, so prefer `findBy*` queries over `getBy*` for
 * content in the initial render.
 */
export function renderWithRouter(ui: ReactElement) {
	const rootRoute = createRootRoute({
		component: () => withCommonProviders(ui),
	});
	const router = createRouter({
		routeTree: rootRoute,
		history: createMemoryHistory(),
	});
	return render(<RouterProvider router={router} />);
}

/**
 * Like `renderWithRouter`, but mounts the component under a `/$academy` route so
 * `useParams({ strict: false })` resolves an `academy` slug — i.e. the "inside
 * an academy" context that academy-aware chrome (header, footer, tab bar) keys
 * off. Without this, those components see no param and render their global
 * (academies-menu) branch instead of the catalogue nav.
 */
export function renderInAcademy(ui: ReactElement, academy = "teachers") {
	const rootRoute = createRootRoute();
	const academyRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "$academy",
		component: () => withCommonProviders(ui),
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([academyRoute]),
		history: createMemoryHistory({ initialEntries: [`/${academy}`] }),
	});
	return render(<RouterProvider router={router} />);
}
