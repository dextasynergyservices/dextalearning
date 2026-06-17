import { createFileRoute } from "@tanstack/react-router";
import { Crown, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LearnerShell } from "@/components/layout/learner-shell";
import { Reveal } from "@/components/marketing/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leaderboard")({
	component: LeaderboardPage,
});

// Podium order: 2nd (left), 1st (center, tallest), 3rd (right).
const PODIUM = [
	{ rank: 2, ring: "ring-slate-300", badge: "bg-slate-300", h: "h-20" },
	{ rank: 1, ring: "ring-amber-400", badge: "bg-amber-400", h: "h-28" },
	{ rank: 3, ring: "ring-orange-300", badge: "bg-orange-300", h: "h-16" },
];

function LeaderboardPage() {
	const { t } = useTranslation("dashboard");

	return (
		<LearnerShell title={t("leaderboard.title")}>
			<div className="pt-5 lg:pt-6">
				<div className="flex items-center gap-3">
					<span className="flex size-11 items-center justify-center rounded-btn bg-brand-accent-light text-amber-700">
						<Trophy className="size-6" />
					</span>
					<div>
						<h2 className="font-display text-2xl text-slate-900 sm:text-3xl">
							{t("leaderboard.title")}
						</h2>
						<p className="text-slate-500">{t("leaderboard.subtitle")}</p>
					</div>
				</div>

				{/* Podium */}
				<div className="mt-6 grid grid-cols-3 items-end gap-3 rounded-card border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-5 shadow-card sm:gap-6 sm:p-8">
					{PODIUM.map(({ rank, ring, badge, h }) => (
						<div key={rank} className="flex flex-col items-center">
							<div className="relative">
								{rank === 1 ? (
									<Crown className="-top-5 -translate-x-1/2 absolute left-1/2 size-6 text-amber-400" />
								) : null}
								<Skeleton
									className={cn("size-12 rounded-full ring-4 sm:size-14", ring)}
								/>
								<span
									className={cn(
										"-bottom-1 -translate-x-1/2 absolute left-1/2 flex size-5 items-center justify-center rounded-full font-stats font-bold text-[10px] text-white",
										badge,
									)}
								>
									{rank}
								</span>
							</div>
							<Skeleton className="mt-3 h-2.5 w-12 sm:w-16" />
							<div
								className={cn(
									"mt-3 w-full rounded-t-card bg-gradient-to-b from-brand-primary/15 to-brand-primary/5",
									h,
								)}
							/>
						</div>
					))}
				</div>

				{/* Ranked list */}
				<Reveal className="mt-5 space-y-3" y={18}>
					{["a", "b", "c", "d", "e"].map((key, i) => (
						<div
							key={key}
							className="flex items-center gap-4 rounded-card border border-slate-200 bg-white p-4 shadow-card"
						>
							<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 font-stats font-bold text-slate-400 text-xs">
								{i + 4}
							</span>
							<Skeleton className="size-10 rounded-full" />
							<div className="flex-1 space-y-2">
								<Skeleton className="h-3 w-1/3" />
								<Skeleton className="h-2 w-1/4" />
							</div>
							<Skeleton className="h-6 w-12" />
						</div>
					))}
				</Reveal>

				<p className="mt-4 text-center text-slate-400 text-sm">
					{t("leaderboard.subtitle")}
				</p>
			</div>
		</LearnerShell>
	);
}
