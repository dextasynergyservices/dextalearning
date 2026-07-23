import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PublicShell } from "@/components/layout/public-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { getAcademy } from "@/lib/content-api";

/**
 * Academy (tenant) layout (§2.1/§2.2). Every `/:academy/*` page hangs off this:
 * the loader resolves the slug to a real academy (name + branding) and turns an
 * unknown slug into a clean 404 for the whole subtree — so no academy-scoped
 * page ever renders for a non-existent academy. Children read the resolved
 * academy from this loader; the current slug is always in `useParams().academy`.
 */
export const Route = createFileRoute("/$academy")({
	loader: async ({ params }) => {
		try {
			return { academy: await getAcademy(params.academy) };
		} catch {
			throw notFound();
		}
	},
	component: () => <Outlet />,
	notFoundComponent: AcademyNotFound,
});

function AcademyNotFound() {
	const { t } = useTranslation("academy");
	return (
		<PublicShell>
			<div className="mx-auto max-w-md px-6 py-24">
				<EmptyState
					icon={BookOpen}
					title={t("not_found.title", { defaultValue: "Academy not found" })}
					description={t("not_found.body", {
						defaultValue:
							"This academy doesn't exist. Check the address or head back home.",
					})}
				/>
			</div>
		</PublicShell>
	);
}
