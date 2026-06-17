import { createFileRoute } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CourseCard } from "@/components/catalog/course-card";
import { FilterChips } from "@/components/catalog/filter-chips";
import { PublicShell } from "@/components/layout/public-shell";
import { buttonVariants } from "@/components/ui/button";
import { SearchField } from "@/components/ui/search-field";
import { useReveal } from "@/hooks/use-reveal";
import { COURSE_CATEGORIES, SAMPLE_COURSES } from "@/lib/sample-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teachers/courses/")({
	component: CoursesCatalogPage,
});

function CoursesCatalogPage() {
	const { t } = useTranslation("academy");
	const [query, setQuery] = useState("");
	const [category, setCategory] = useState<string>("all");

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return SAMPLE_COURSES.filter((course) => {
			const matchesCategory =
				category === "all" || course.category === category;
			const matchesQuery =
				q === "" ||
				course.title.toLowerCase().includes(q) ||
				course.summary.toLowerCase().includes(q) ||
				course.instructorName.toLowerCase().includes(q);
			return matchesCategory && matchesQuery;
		});
	}, [query, category]);

	const reset = () => {
		setQuery("");
		setCategory("all");
	};

	const headerRef = useReveal<HTMLDivElement>();
	const gridRef = useReveal<HTMLDivElement>();

	return (
		<PublicShell mobileTitle={t("catalog.title")}>
			<div className="mx-auto max-w-7xl px-4 lg:px-8">
				<div ref={headerRef} className="hidden pt-28 lg:block">
					<h1
						data-reveal
						className="font-display text-4xl tracking-tight text-slate-900"
					>
						{t("catalog.title")}
					</h1>
					<p data-reveal className="mt-2 text-lg text-slate-500">
						{t("catalog.subtitle")}
					</p>
				</div>

				{/* Sticky search + filters (app-style) */}
				<div className="-mx-4 sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 border-slate-100 border-b bg-white/90 px-4 py-3 backdrop-blur-md lg:static lg:mx-0 lg:mt-8 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
					<SearchField
						value={query}
						onChange={setQuery}
						placeholder={t("catalog.search_placeholder")}
					/>
					<div className="mt-3">
						<FilterChips
							items={COURSE_CATEGORIES}
							active={category}
							onChange={setCategory}
							labelPrefix="categories"
						/>
					</div>
				</div>

				<p className="mt-4 text-slate-500 text-sm">
					{t("catalog.results", { count: filtered.length })}
				</p>

				{filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 text-center">
						<span className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
							<Compass className="size-7" />
						</span>
						<h2 className="mt-4 font-display text-slate-900 text-xl">
							{t("catalog.empty_title")}
						</h2>
						<p className="mt-1 text-slate-500">{t("catalog.empty_body")}</p>
						<button
							type="button"
							onClick={reset}
							className={cn(
								buttonVariants({ variant: "outline", size: "sm" }),
								"mt-4",
							)}
						>
							{t("catalog.clear")}
						</button>
					</div>
				) : (
					<div
						ref={gridRef}
						className="mt-4 grid gap-5 pb-10 sm:grid-cols-2 lg:grid-cols-3"
					>
						{filtered.map((course) => (
							<div key={course.slug} data-reveal="scale">
								<CourseCard course={course} />
							</div>
						))}
					</div>
				)}
			</div>
		</PublicShell>
	);
}
