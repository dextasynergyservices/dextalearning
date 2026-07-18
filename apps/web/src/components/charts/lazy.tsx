import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Lazy entry points for the recharts-based charts (§13.2). recharts + its d3
 * dependencies are far too heavy for the main bundle — every consumer imports
 * THESE, never the chart modules directly, so Vite splits the charting stack
 * into its own chunk that only dashboard visitors download. (The completion
 * funnel is plain HTML and needs no seam — import it directly.)
 */
const EnrolmentTrendChartInner = lazy(() => import("./enrolment-trend-chart"));
const EarningsTrendChartInner = lazy(() => import("./earnings-trend-chart"));
const PlatformRevenueChartInner = lazy(
	() => import("./platform-revenue-chart"),
);
const LearnerGrowthChartInner = lazy(() => import("./learner-growth-chart"));
// The donut cards import recharts via DonutChart, so they ride the same seam.
const OutcomeDonutCardInner = lazy(() =>
	import("./composition-cards").then((m) => ({ default: m.OutcomeDonutCard })),
);
const EarnBackOutcomesCardInner = lazy(() =>
	import("./composition-cards").then((m) => ({
		default: m.EarnBackOutcomesCard,
	})),
);
const RevenueByTypeCardInner = lazy(() =>
	import("./composition-cards").then((m) => ({
		default: m.RevenueByTypeCard,
	})),
);

const fallback = <Skeleton className="h-80 w-full rounded-card" />;

export function LazyEnrolmentTrendChart() {
	return (
		<Suspense fallback={fallback}>
			<EnrolmentTrendChartInner />
		</Suspense>
	);
}

export function LazyEarningsTrendChart() {
	return (
		<Suspense fallback={fallback}>
			<EarningsTrendChartInner />
		</Suspense>
	);
}

export function LazyPlatformRevenueChart() {
	return (
		<Suspense fallback={fallback}>
			<PlatformRevenueChartInner />
		</Suspense>
	);
}

export function LazyLearnerGrowthChart() {
	return (
		<Suspense fallback={fallback}>
			<LearnerGrowthChartInner />
		</Suspense>
	);
}

const donutFallback = <Skeleton className="h-64 w-full rounded-card" />;

export function LazyOutcomeDonutCard() {
	return (
		<Suspense fallback={donutFallback}>
			<OutcomeDonutCardInner />
		</Suspense>
	);
}

export function LazyEarnBackOutcomesCard() {
	return (
		<Suspense fallback={donutFallback}>
			<EarnBackOutcomesCardInner />
		</Suspense>
	);
}

export function LazyRevenueByTypeCard() {
	return (
		<Suspense fallback={donutFallback}>
			<RevenueByTypeCardInner />
		</Suspense>
	);
}
