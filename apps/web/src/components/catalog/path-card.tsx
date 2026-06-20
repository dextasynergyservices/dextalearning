import { Link } from "@tanstack/react-router";
import { BookOpen, Clock, Users, Waypoints } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CatalogVisual } from "@/components/catalog/catalog-visual";
import { formatCompact, formatNgn } from "@/lib/format";
import type { SamplePath } from "@/lib/sample-data";

export function PathCard({ path }: { path: SamplePath }) {
	const { t } = useTranslation("academy");
	const isFree = path.priceNgn === 0;
	const courseCount = path.courseSlugs.length;

	return (
		<Link
			to="/teachers/paths/$slug"
			params={{ slug: path.slug }}
			className="group flex flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover active:scale-[0.99]"
		>
			<CatalogVisual
				icon={Waypoints}
				label={t(`level.${path.level}`)}
				meta={t("paths.courses_count", { count: courseCount })}
				tone="accent"
			>
				{path.isEarnBack ? (
					<span className="badge-earnback bg-white/90">
						{t("card.earn_back")}
					</span>
				) : null}
			</CatalogVisual>

			<div className="flex flex-1 flex-col p-4">
				<h3 className="line-clamp-2 font-display text-base text-slate-900 leading-snug">
					{path.title}
				</h3>
				<p className="mt-1.5 line-clamp-2 flex-1 text-slate-500 text-sm">
					{path.summary}
				</p>
				<div className="mt-3 flex items-center gap-3 text-slate-500 text-xs">
					<span className="inline-flex items-center gap-1">
						<BookOpen className="size-3.5" />{" "}
						{t("paths.courses_count", { count: courseCount })}
					</span>
					<span className="inline-flex items-center gap-1">
						<Clock className="size-3.5" /> {path.estimatedHours}h
					</span>
				</div>
				<div className="mt-3 flex items-center justify-between border-slate-100 border-t pt-3">
					<span className="font-display text-base text-slate-900">
						{isFree ? t("card.free") : formatNgn(path.priceNgn)}
					</span>
					<span className="inline-flex items-center gap-1 text-slate-400 text-xs">
						<Users className="size-3.5" /> {formatCompact(path.enrolled)}
					</span>
				</div>
			</div>
		</Link>
	);
}
