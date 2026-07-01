import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { authClient, homeForRole, safeRedirect } from "@/lib/auth-client";

/**
 * Post-auth resolver. Flows that can't know the user's role at request time
 * (magic-link sign-in, and any OAuth/email callback) land here: it reads the
 * now-authenticated session and routes by role via `homeForRole`, honouring an
 * explicit `?redirect=` first. Keeps role-based landing consistent everywhere.
 */
export const Route = createFileRoute("/continue")({
	validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
		redirect: typeof search.redirect === "string" ? search.redirect : undefined,
	}),
	component: ContinuePage,
});

function ContinuePage() {
	const { redirect } = Route.useSearch();

	useEffect(() => {
		(async () => {
			const { data } = await authClient.getSession();
			const role = (data?.user as { role?: string } | undefined)?.role;
			const target = safeRedirect(redirect) ?? homeForRole(role);
			// Hard nav so the destination loads fresh WITH the session cookie
			// (mirrors the login flow's deliberate full-page navigation).
			window.location.assign(target);
		})();
	}, [redirect]);

	return (
		<div className="flex min-h-screen items-center justify-center bg-muted">
			<Loader2 className="size-6 animate-spin text-brand-primary" />
		</div>
	);
}
