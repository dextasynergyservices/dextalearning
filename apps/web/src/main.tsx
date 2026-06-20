import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { MotionConfig } from "framer-motion";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import "./lib/fonts";
import "./index.css";
import "lenis/dist/lenis.css";
import "./lib/i18n";
import { routeTree } from "./routeTree.gen";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
	},
});

const router = createRouter({
	routeTree,
	context: { queryClient },
	defaultPreload: "intent",
	scrollRestoration: true,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const rootElement = document.getElementById("root");

if (!rootElement) {
	throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
	<StrictMode>
		<MotionConfig reducedMotion="user">
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
				<Toaster position="top-center" richColors closeButton />
			</QueryClientProvider>
		</MotionConfig>
	</StrictMode>,
);
