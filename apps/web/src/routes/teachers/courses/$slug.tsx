import { createFileRoute, redirect } from "@tanstack/react-router";

// The canonical course detail lives at `/courses/$slug`. Keep this legacy path
// working by redirecting to the real, data-backed page.
export const Route = createFileRoute("/teachers/courses/$slug")({
	beforeLoad: ({ params }) => {
		throw redirect({ to: "/courses/$slug", params: { slug: params.slug } });
	},
});
