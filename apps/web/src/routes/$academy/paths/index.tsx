import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FilterChips } from "@/components/catalog/filter-chips";
import { PagedGrid } from "@/components/catalog/paged-grid";
import { PublicPathCard } from "@/components/catalog/public-cards";
import { PublicShell } from "@/components/layout/public-shell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchField } from "@/components/ui/search-field";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublishedPaths } from "@/lib/content-api";
import { cn } from "@/lib/utils";

const PATH_LEVELS = [
	"all",
	"beginner",
	"intermediate",
	"advanced",
	"mixed",
] as const;

export const Route = createFileRoute("/$academy/paths/")({
	component: PathsCatalogPage,
});

function PathsCatalogPage() {
	const { t } = useTranslation(["academy", "authoring"]);
	const { academy } = Route.useParams();
	const [query, setQuery] = useState("");
	const [level, setLevel] = useState<string>("all");

	const { data: paths, isPending } = useQuery({
		queryKey: ["published-paths", academy],
		queryFn: () => getPublishedPaths(academy),
		staleTime: 0,
		refetchOnMount: "always",
	});

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return (paths ?? []).filter((path) => {
			const matchesLevel = level === "all" || path.level === level;
			const matchesQuery =
				q === "" ||
				path.title.toLowerCase().includes(q) ||
				(path.description ?? "").toLowerCase().includes(q);
			return matchesLevel && matchesQuery;
		});
	}, [paths, query, level]);

	const reset = () => {
		setQuery("");
		setLevel("all");
	};

	return (
		<PublicShell mobileTitle={t("paths.title")}>
			<div className="mx-auto max-w-7xl px-4 lg:px-8">
				<div className="hidden pt-28 lg:block">
					<h1 className="font-display text-4xl tracking-tight text-foreground">
						{t("paths.title")}
					</h1>
					<p className="mt-2 text-lg text-muted-foreground">
						{t("paths.subtitle")}
					</p>
				</div>

				<div className="-mx-4 sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 border-border border-b bg-card/90 px-4 py-3 backdrop-blur-md lg:static lg:mx-0 lg:mt-8 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
					<SearchField
						value={query}
						onChange={setQuery}
						placeholder={t("paths.search_placeholder")}
					/>
					<div className="mt-3">
						<FilterChips
							items={PATH_LEVELS}
							active={level}
							onChange={setLevel}
							labelPrefix="level"
						/>
					</div>
				</div>

				{isPending ? (
					<div className="mt-6 grid gap-5 pb-10 sm:grid-cols-2 lg:grid-cols-3">
						{["a", "b", "c"].map((k) => (
							<Skeleton key={k} className="h-56 rounded-card" />
						))}
					</div>
				) : filtered.length === 0 ? (
					<EmptyState
						className="my-12"
						icon={Compass}
						title={t("catalog.empty_title")}
						description={
							paths && paths.length > 0
								? t("catalog.empty_body")
								: t("paths.empty", {
										ns: "authoring",
										defaultValue: "No paths published yet.",
									})
						}
						action={
							query || level !== "all" ? (
								<button
									type="button"
									onClick={reset}
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
							{t("paths.results", { count: filtered.length })}
						</p>
						<PagedGrid
							items={filtered}
							getKey={(p) => p.id}
							resetKey={`${query}-${level}`}
							className="mt-4 grid gap-5 pb-10 sm:grid-cols-2 lg:grid-cols-3"
							render={(path) => <PublicPathCard path={path} />}
						/>
					</>
				)}
			</div>
		</PublicShell>
	);
}
