import { createFileRoute, redirect } from "@tanstack/react-router";

// Course detail is global + canonical at `/courses/$slug`. Keep the academy-
// scoped path (and legacy `/teachers/courses/$slug`) working by redirecting.
export const Route = createFileRoute("/$academy/courses/$slug")({
	beforeLoad: ({ params }) => {
		throw redirect({ to: "/courses/$slug", params: { slug: params.slug } });
	},
});
