import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PagedGrid } from "@/components/catalog/paged-grid";
import { PublicCohortCard } from "@/components/catalog/public-cards";
import { PublicShell } from "@/components/layout/public-shell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchField } from "@/components/ui/search-field";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublishedCohorts } from "@/lib/content-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teachers/cohorts/")({
	component: CohortsCatalogPage,
});

function CohortsCatalogPage() {
	const { t } = useTranslation(["academy", "authoring", "dashboard"]);
	const [query, setQuery] = useState("");

	const { data: cohorts, isPending } = useQuery({
		queryKey: ["published-cohorts"],
		queryFn: getPublishedCohorts,
		staleTime: 0,
		refetchOnMount: "always",
	});

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return (cohorts ?? []).filter(
			(c) =>
				q === "" ||
				c.title.toLowerCase().includes(q) ||
				(c.description ?? "").toLowerCase().includes(q),
		);
	}, [cohorts, query]);

	return (
		<PublicShell mobileTitle={t("cohorts.title")}>
			<div className="mx-auto max-w-7xl px-4 lg:px-8">
				<div className="hidden pt-28 lg:block">
					<h1 className="font-display text-4xl tracking-tight text-foreground">
						{t("cohorts.title")}
					</h1>
					<p className="mt-2 text-lg text-muted-foreground">
						{t("cohorts.subtitle")}
					</p>
				</div>

				<div className="-mx-4 sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 border-border border-b bg-card/90 px-4 py-3 backdrop-blur-md lg:static lg:mx-0 lg:mt-8 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
					<SearchField
						value={query}
						onChange={setQuery}
						placeholder={t("cohorts.search_placeholder")}
					/>
				</div>

				{isPending ? (
					<div className="mt-6 grid gap-5 pb-10 sm:grid-cols-2 lg:grid-cols-3">
						{["a", "b", "c"].map((k) => (
							<Skeleton key={k} className="h-48 rounded-card" />
						))}
					</div>
				) : filtered.length === 0 ? (
					<EmptyState
						className="my-12"
						icon={Compass}
						title={t("catalog.empty_title")}
						description={
							cohorts && cohorts.length > 0
								? t("catalog.empty_body")
								: t("cohorts.empty", {
										ns: "authoring",
										defaultValue: "No open cohorts right now.",
									})
						}
						action={
							query ? (
								<button
									type="button"
									onClick={() => setQuery("")}
									className={cn(
										buttonVariants({ variant: "outline", size: "sm" }),
									)}
								>
									{t("catalog.clear")}
								</button>
							) : undefined
						}
					/>
				) : (
					<>
						<p className="mt-4 text-muted-foreground text-sm">
							{t("cohorts.results", { count: filtered.length })}
						</p>
						<PagedGrid
							items={filtered}
							getKey={(c) => c.id}
							resetKey={query}
							className="mt-4 grid gap-5 pb-10 sm:grid-cols-2 lg:grid-cols-3"
							render={(cohort) => <PublicCohortCard cohort={cohort} />}
						/>
					</>
				)}
			</div>
		</PublicShell>
	);
}
