import {
	Award,
	BookMarked,
	BookOpen,
	Briefcase,
	CalendarCheck,
	Crown,
	Flame,
	GraduationCap,
	Layers,
	Library,
	Medal,
	Sparkles,
	Sunrise,
	Target,
	TrendingUp,
	Zap,
} from "lucide-react";
import type { ComponentType } from "react";

/**
 * Client-side badge catalogue (§3.2). Keys mirror the API's stable
 * `badge.definitions.ts` contract; names/descriptions live in the
 * `engagement` i18n namespace (`badges.<key>.name` / `.desc`).
 */
export interface BadgeMeta {
	icon: ComponentType<{ className?: string }>;
	/** Medallion background for the earned state. */
	tint: string;
}

export const BADGE_META: Record<string, BadgeMeta> = {
	first_lesson: { icon: Sparkles, tint: "bg-emerald-500" },
	lessons_10: { icon: BookOpen, tint: "bg-sky-500" },
	lessons_25: { icon: BookMarked, tint: "bg-cyan-600" },
	lessons_50: { icon: Library, tint: "bg-indigo-500" },
	first_course: { icon: GraduationCap, tint: "bg-brand-primary" },
	courses_3: { icon: Layers, tint: "bg-violet-500" },
	first_quiz_pass: { icon: Award, tint: "bg-teal-500" },
	quizzes_10: { icon: Medal, tint: "bg-fuchsia-600" },
	perfect_quiz: { icon: Target, tint: "bg-rose-500" },
	growth_leap: { icon: TrendingUp, tint: "bg-emerald-600" },
	streak_3: { icon: Flame, tint: "bg-amber-500" },
	streak_7: { icon: CalendarCheck, tint: "bg-orange-500" },
	streak_14: { icon: Zap, tint: "bg-amber-600" },
	streak_30: { icon: Crown, tint: "bg-yellow-500" },
	comeback: { icon: Sunrise, tint: "bg-orange-400" },
	first_project_pass: { icon: Briefcase, tint: "bg-slate-600" },
};

export const FALLBACK_BADGE_META: BadgeMeta = {
	icon: Award,
	tint: "bg-brand-primary",
};

export function badgeMetaOf(key: string): BadgeMeta {
	return BADGE_META[key] ?? FALLBACK_BADGE_META;
}
