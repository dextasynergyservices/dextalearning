import { Link } from "@tanstack/react-router";
import { BookOpen, Clock, PlayCircle, Star, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CatalogVisual } from "@/components/catalog/catalog-visual";
import { formatCompact, formatNgn } from "@/lib/format";
import type { SampleCourse } from "@/lib/sample-data";

export function CourseCard({ course }: { course: SampleCourse }) {
	const { t } = useTranslation("academy");
	const isFree = course.priceNgn === 0;

	return (
		<Link
			to="/teachers/courses/$slug"
			params={{ slug: course.slug }}
			className="group flex flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover active:scale-[0.99]"
		>
			<CatalogVisual
				icon={BookOpen}
				label={t(`level.${course.level}`)}
				meta={t(`categories.${course.category}`)}
			>
				<div className="flex items-center gap-2">
					<PlayCircle className="size-5 transition-transform group-hover:scale-110" />
					{isFree ? (
						<span className="badge-free bg-white/90">{t("card.free")}</span>
					) : course.isEarnBack ? (
						<span className="badge-earnback bg-white/90">
							{t("card.earn_back")}
						</span>
					) : null}
				</div>
			</CatalogVisual>

			<div className="flex flex-1 flex-col p-4">
				<p className="font-stats font-semibold text-brand-primary text-xs uppercase tracking-wide">
					{t(`categories.${course.category}`)}
				</p>
				<h3 className="mt-1 line-clamp-2 font-display text-base text-slate-900 leading-snug">
					{course.title}
				</h3>
				<p className="mt-1 text-slate-500 text-sm">
					{t("card.by", { name: course.instructorName })}
				</p>

				<div className="mt-3 flex items-center gap-3 text-slate-500 text-xs">
					<span className="inline-flex items-center gap-1 text-amber-500">
						<Star className="size-3.5 fill-current" />
						<span className="font-medium text-slate-700">{course.rating}</span>
					</span>
					<span className="inline-flex items-center gap-1">
						<Clock className="size-3.5" /> {course.durationHours}h
					</span>
					<span>{t("card.lessons", { count: course.lessonCount })}</span>
				</div>

				<div className="mt-3 flex items-center justify-between border-slate-100 border-t pt-3">
					<span className="font-display text-base text-slate-900">
						{isFree ? t("card.free") : formatNgn(course.priceNgn)}
					</span>
					<span className="inline-flex items-center gap-1 text-slate-400 text-xs">
						<Users className="size-3.5" /> {formatCompact(course.enrolled)}
					</span>
				</div>
			</div>
		</Link>
	);
}
