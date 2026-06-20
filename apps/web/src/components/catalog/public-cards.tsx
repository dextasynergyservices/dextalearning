import { Link } from "@tanstack/react-router";
import {
	ArrowRight,
	BookOpen,
	CalendarDays,
	Clock3,
	Layers3,
	Users,
	Waypoints,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
	formatMoney,
	type PublishedCohort,
	type PublishedCourse,
	type PublishedPath,
} from "@/lib/content-api";
import { CommercialBadge } from "./commercial-badge";

const CARD =
	"group flex flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover";

function useCardLabels() {
	const { t } = useTranslation(["academy", "authoring", "dashboard"]);
	return {
		view: t("home.view_course", { ns: "dashboard" }),
		price: (c: { isFree: boolean; currency: string; price: number | null }) =>
			c.isFree ? t("catalog.free") : formatMoney(c.currency, c.price ?? 0),
		t,
	};
}

function startLabel(iso: string | null): string | null {
	if (!iso) return null;
	return new Date(iso).toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function PublicCourseCard({ course }: { course: PublishedCourse }) {
	const l = useCardLabels();
	return (
		<Link to="/courses/$slug" params={{ slug: course.slug }} className={CARD}>
			<div className="relative aspect-[16/8] overflow-hidden bg-slate-100">
				{course.thumbnailUrl ? (
					<img
						src={course.thumbnailUrl}
						alt=""
						className="size-full object-cover transition-transform group-hover:scale-[1.03]"
					/>
				) : (
					<span className="flex size-full items-center justify-center text-brand-primary/40">
						<BookOpen className="size-10" />
					</span>
				)}
				<CommercialBadge
					isFree={course.isFree}
					isEarnBackEligible={course.isEarnBackEligible}
					earnBackPercentage={course.earnBackPercentage}
					className="absolute top-2 right-2 shadow-sm"
				/>
			</div>
			<div className="flex flex-1 flex-col p-4">
				<h3 className="line-clamp-2 font-display text-slate-900">
					{course.title}
				</h3>
				{course.description ? (
					<p className="mt-1 line-clamp-2 text-slate-500 text-sm">
						{course.description}
					</p>
				) : null}
				<span className="mt-1.5 text-slate-400 text-xs">
					{l.t("courses.modules", {
						ns: "authoring",
						count: course._count.modules,
					})}
				</span>
				<div className="mt-auto flex items-center justify-between pt-3">
					<span className="font-stats font-bold text-slate-900 text-sm">
						{l.price(course)}
					</span>
					<span className="flex items-center gap-1 font-semibold text-brand-primary text-sm transition-all group-hover:gap-1.5">
						{l.view}
						<ArrowRight className="size-4" />
					</span>
				</div>
			</div>
		</Link>
	);
}

export function PublicPathCard({ path }: { path: PublishedPath }) {
	const l = useCardLabels();
	return (
		<Link
			to="/teachers/paths/$slug"
			params={{ slug: path.slug }}
			className={CARD}
		>
			<div className="relative aspect-[16/8] overflow-hidden bg-slate-100">
				{path.thumbnailUrl ? (
					<img
						src={path.thumbnailUrl}
						alt=""
						className="size-full object-cover transition-transform group-hover:scale-[1.03]"
					/>
				) : (
					<span className="flex size-full items-center justify-center text-brand-primary/40">
						<Waypoints className="size-10" />
					</span>
				)}
				<CommercialBadge
					isFree={path.isFree}
					isEarnBackEligible={path.isEarnBackEligible}
					earnBackPercentage={path.earnBackPercentage}
					className="absolute top-2 right-2 shadow-sm"
				/>
			</div>
			<div className="flex flex-1 flex-col p-4">
				<h3 className="line-clamp-2 font-display text-slate-900">
					{path.title}
				</h3>
				{path.outcomeStatement || path.description ? (
					<p className="mt-1 line-clamp-2 text-slate-500 text-sm">
						{path.outcomeStatement || path.description}
					</p>
				) : null}
				<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400 text-xs">
					<span className="flex items-center gap-1">
						<Layers3 className="size-3.5" />
						{l.t("paths.courses_count", {
							ns: "authoring",
							count: path._count.pathCourses,
						})}
					</span>
					{path.estimatedHours ? (
						<span className="flex items-center gap-1">
							<Clock3 className="size-3.5" />
							{l.t("paths.hours", {
								ns: "authoring",
								count: path.estimatedHours,
							})}
						</span>
					) : null}
				</div>
				<div className="mt-auto flex items-center justify-between pt-3">
					<span className="font-stats font-bold text-slate-900 text-sm">
						{l.price(path)}
					</span>
					<span className="flex items-center gap-1 font-semibold text-brand-primary text-sm transition-all group-hover:gap-1.5">
						{l.view}
						<ArrowRight className="size-4" />
					</span>
				</div>
			</div>
		</Link>
	);
}

export function PublicCohortCard({ cohort }: { cohort: PublishedCohort }) {
	const l = useCardLabels();
	return (
		<Link
			to="/teachers/cohorts/$slug"
			params={{ slug: cohort.slug }}
			className="group flex flex-col rounded-card border border-slate-200 bg-white p-5 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
		>
			<div className="flex items-start justify-between gap-2">
				<span className="flex size-11 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
					<CalendarDays className="size-5" />
				</span>
				<CommercialBadge
					isFree={cohort.isFree}
					isEarnBackEligible={cohort.isEarnBackEligible}
					earnBackPercentage={cohort.earnBackPercentage}
				/>
			</div>
			<h3 className="mt-3 line-clamp-2 font-display text-slate-900">
				{cohort.title}
			</h3>
			{cohort.description ? (
				<p className="mt-1 line-clamp-2 text-slate-500 text-sm">
					{cohort.description}
				</p>
			) : null}
			<div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400 text-xs">
				{startLabel(cohort.startsAt) ? (
					<span className="flex items-center gap-1">
						<CalendarDays className="size-3.5" />
						{startLabel(cohort.startsAt)}
					</span>
				) : null}
				<span className="flex items-center gap-1">
					<BookOpen className="size-3.5" />
					{cohort._count.courses}
				</span>
				{cohort.capacity ? (
					<span className="flex items-center gap-1">
						<Users className="size-3.5" />
						{cohort.seatsFilled}/{cohort.capacity}
					</span>
				) : null}
			</div>
			<div className="mt-auto flex items-center justify-between pt-3">
				<span className="font-stats font-bold text-slate-900 text-sm">
					{l.price(cohort)}
				</span>
				<span className="flex items-center gap-1 font-semibold text-brand-primary text-sm transition-all group-hover:gap-1.5">
					{l.view}
					<ArrowRight className="size-4" />
				</span>
			</div>
		</Link>
	);
}
