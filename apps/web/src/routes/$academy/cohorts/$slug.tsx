import { createFileRoute, redirect } from "@tanstack/react-router";

// Cohort detail is global + canonical at `/cohorts/$slug`. Keep the academy-
// scoped path (and legacy `/teachers/cohorts/$slug`) working by redirecting.
export const Route = createFileRoute("/$academy/cohorts/$slug")({
	beforeLoad: ({ params }) => {
		throw redirect({ to: "/cohorts/$slug", params: { slug: params.slug } });
	},
});
