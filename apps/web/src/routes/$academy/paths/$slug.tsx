import { createFileRoute, redirect } from "@tanstack/react-router";

// Path detail is global + canonical at `/paths/$slug`. Keep the academy-scoped
// path (and legacy `/teachers/paths/$slug`) working by redirecting.
export const Route = createFileRoute("/$academy/paths/$slug")({
	beforeLoad: ({ params }) => {
		throw redirect({ to: "/paths/$slug", params: { slug: params.slug } });
	},
});
