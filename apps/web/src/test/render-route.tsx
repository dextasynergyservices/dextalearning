import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { routeTree } from "@/routeTree.gen";

/**
 * Renders a real file-route (e.g. `routes/register.tsx`) by building the
 * **actual** router production uses (same `routeTree.gen.ts`, same
 * `context: { queryClient }` shape as `main.tsx`) but with `createMemoryHistory`
 * instead of browser history — TanStack Router's own recommended pattern for
 * testing route components without hand-rolling a fake route tree. Covers
 * `Route.useSearch()`, `useNavigate()`, and `Link` for real.
 *
 * Route resolution can be async (code-split routes, loaders) — prefer RTL's
 * `findBy*` queries over `getBy*` in tests using this helper.
 */
export function renderRoute(path: string) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	const router = createRouter({
		routeTree,
		context: { queryClient },
		history: createMemoryHistory({ initialEntries: [path] }),
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
}
