import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { useSession } from "@/lib/auth-client";

/**
 * Client-side guard for learner-only routes. While the Better Auth session is
 * resolving we show a centered spinner; once resolved, an unauthenticated
 * visitor is redirected to /login and authenticated content is rendered.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
	const { data: session, isPending } = useSession();
	const navigate = useNavigate();

	useEffect(() => {
		if (!isPending && !session) {
			navigate({ to: "/login" });
		}
	}, [isPending, session, navigate]);

	if (isPending) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-50">
				<Loader2 className="size-6 animate-spin text-brand-primary" />
			</div>
		);
	}

	if (!session) return null;

	return <>{children}</>;
}
