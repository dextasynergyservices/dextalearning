import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Flame, Star, TrendingUp, Trophy, Users } from "lucide-react";
import { type ComponentType, useState } from "react";
import { useTranslation } from "react-i18next";
import { BadgeGrid } from "@/components/engagement/badge-grid";
import { LearnerShell } from "@/components/layout/learner-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth-client";
import { engagementKeys, getEngagementMe } from "@/lib/engagement-api";
import {
	getLeaderboard,
	type LeaderboardPeriod,
	type LeaderboardType,
	leaderboardKeys,
} from "@/lib/leaderboard-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leaderboard")({
	component: AwardsPage,
});

// The five leaderboard types (blueprint §4.9).
const TYPES: {
	key: LeaderboardType;
	icon: ComponentType<{ className?: string }>;
}[] = [
	{ key: "overall", icon: Trophy },
	{ key: "consistency", icon: Flame },
	{ key: "improved", icon: TrendingUp },
	{ key: "group", icon: Users },
	{ key: "peer", icon: Star },
];

const PERIODS: LeaderboardPeriod[] = ["all_time", "weekly"];

const TINTS = [
	"bg-brand-primary",
	"bg-indigo-600",
	"bg-emerald-600",
	"bg-amber-600",
	"bg-rose-500",
	"bg-slate-600",
	"bg-teal-600",
	"bg-violet-600",
];

interface Row {
	subjectId: string;
	name: string;
	points: number;
	rank: number;
	isYou: boolean;
}

function initialsOf(name: string): string {
	return (
		name
			.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? "")
			.join("") || "?"
	);
}

function tintFor(name: string): string {
	let hash = 0;
	for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
	return TINTS[hash % TINTS.length];
}

function Avatar({
	name,
	image,
	className,
}: {
	name: string;
	image?: string | null;
	className: string;
}) {
	if (image) {
		return (
			<img
				src={image}
				alt=""
				className={cn("rounded-full object-cover", className)}
			/>
		);
	}
	return (
		<span
			className={cn(
				"flex items-center justify-center rounded-full font-display text-white",
				tintFor(name),
				className,
			)}
		>
			{initialsOf(name)}
		</span>
	);
}

const PODIUM_META: Record<
	number,
	{ ring: string; bar: string; badge: string; height: string }
> = {
	1: {
		ring: "ring-amber-400",
		bar: "bg-amber-500/20",
		badge: "bg-amber-400",
		height: "h-20 sm:h-24",
	},
	2: {
		ring: "ring-slate-300",
		bar: "bg-muted",
		badge: "bg-slate-400",
		height: "h-14 sm:h-16",
	},
	3: {
		ring: "ring-orange-300",
		bar: "bg-orange-500/20",
		badge: "bg-orange-400",
		height: "h-10 sm:h-12",
	},
};

function AwardsPage() {
	const { t } = useTranslation("dashboard");
	const { data: session } = useSession();
	const user = session?.user;
	const [type, setType] = useState<LeaderboardType>("overall");
	const [period, setPeriod] = useState<LeaderboardPeriod>("all_time");

	const { data: engagement } = useQuery({
		queryKey: engagementKeys.me,
		queryFn: getEngagementMe,
	});
	const { data: board, isPending } = useQuery({
		queryKey: leaderboardKeys.board(type, period),
		queryFn: () => getLeaderboard({ type, period, limit: 20 }),
	});

	const isGroup = board?.kind === "group";
	const labelFor = (row: Row) =>
		row.isYou && !isGroup ? t("leaderboard.you") : row.name;

	const rows: Row[] =
		board?.entries.map((e) => ({
			subjectId: e.subjectId,
			name: e.name,
			points: e.score,
			rank: e.rank,
			isYou: e.isSelf,
		})) ?? [];
	const you: Row | null = board?.me
		? {
				subjectId: board.me.subjectId,
				name: board.me.name,
				points: board.me.score,
				rank: board.me.rank,
				isYou: true,
			}
		: null;

	const podium = rows.slice(0, 3);
	const rest = rows.slice(3);
	// Display order for the podium: 2nd · 1st · 3rd.
	const podiumOrder = [podium[1], podium[0], podium[2]].filter(
		Boolean,
	) as Row[];

	return (
		<LearnerShell title={t("leaderboard.title")}>
			<div className="space-y-6 pt-5 lg:pt-6">
				<div>
					<h2 className="font-display text-2xl text-foreground sm:text-3xl">
						{t("leaderboard.title")}
					</h2>
					<p className="mt-1 text-muted-foreground">
						{t("leaderboard.subtitle")}
					</p>
				</div>

				{engagement ? (
					<BadgeGrid
						badges={engagement.badges}
						allKeys={engagement.allBadgeKeys}
					/>
				) : null}

				{/* Type selector with an animated active pill — wraps so no tab
				    ever runs off a narrow screen. */}
				<div className="flex flex-wrap gap-2">
					{TYPES.map(({ key, icon: Icon }) => {
						const active = type === key;
						return (
							<button
								key={key}
								type="button"
								onClick={() => setType(key)}
								className={cn(
									"relative inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-3.5 py-2 font-medium text-sm transition-colors",
									active
										? "border-brand-primary text-white"
										: "border-border bg-card text-muted-foreground hover:border-brand-primary/40 hover:text-foreground",
								)}
							>
								{active ? (
									<motion.span
										layoutId="lb-tab"
										className="absolute inset-0 rounded-pill bg-brand-primary"
										transition={{ type: "spring", stiffness: 380, damping: 30 }}
									/>
								) : null}
								<Icon className="relative z-10 size-4" />
								<span className="relative z-10">
									{t(`leaderboard.types.${key}`)}
								</span>
							</button>
						);
					})}
				</div>

				{/* Period segmented control */}
				<div className="inline-flex rounded-pill border border-border bg-card p-0.5">
					{PERIODS.map((p) => (
						<button
							key={p}
							type="button"
							onClick={() => setPeriod(p)}
							className={cn(
								"rounded-pill px-3.5 py-1.5 font-medium text-sm transition-colors",
								period === p
									? "bg-brand-primary text-white"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{t(`leaderboard.period_${p}`, {
								defaultValue: p === "weekly" ? "This week" : "All-time",
							})}
						</button>
					))}
				</div>

				{isPending ? (
					<div className="space-y-3">
						<Skeleton className="h-40 rounded-card" />
						<Skeleton className="h-16 rounded-card" />
						<Skeleton className="h-16 rounded-card" />
					</div>
				) : rows.length === 0 ? (
					<div className="rounded-card border border-border border-dashed bg-card p-10 text-center">
						<Trophy className="mx-auto size-8 text-muted-foreground" />
						<p className="mt-3 font-display text-foreground">
							{t("leaderboard.empty_title", {
								defaultValue: "No rankings yet",
							})}
						</p>
						<p className="mt-1 text-muted-foreground text-sm">
							{t("leaderboard.empty_body", {
								type: t(`leaderboard.types.${type}`),
								defaultValue:
									"Complete lessons and quizzes to climb the board.",
							})}
						</p>
					</div>
				) : (
					<AnimatePresence mode="wait">
						<motion.div
							key={`${type}-${period}`}
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -8 }}
							transition={{ duration: 0.25 }}
							className="space-y-6"
						>
							{/* Podium */}
							<section className="rounded-card border border-border bg-card p-5 shadow-card sm:p-6">
								<p className="mb-4 font-stats font-semibold text-muted-foreground text-xs uppercase tracking-wide">
									{t(`leaderboard.period_${period}`, {
										defaultValue:
											period === "weekly" ? "This week" : "All-time",
									})}
								</p>
								<div className="grid grid-cols-3 items-end gap-3 sm:gap-5">
									{podiumOrder.map((entry, i) => {
										const meta = PODIUM_META[entry.rank] ?? PODIUM_META[3];
										return (
											<motion.div
												key={entry.subjectId}
												initial={{ opacity: 0, y: 30 }}
												animate={{ opacity: 1, y: 0 }}
												transition={{
													delay: 0.1 + i * 0.1,
													type: "spring",
													stiffness: 260,
													damping: 22,
												}}
												className="flex flex-col items-center"
											>
												<div className="relative">
													{entry.rank === 1 ? (
														<Crown className="-top-5 -translate-x-1/2 absolute left-1/2 size-6 text-amber-400" />
													) : null}
													<Avatar
														name={entry.name}
														image={
															entry.isYou && !isGroup ? user?.image : undefined
														}
														className={cn(
															"size-12 text-base ring-4 sm:size-16 sm:text-lg",
															meta.ring,
														)}
													/>
													<span
														className={cn(
															"-bottom-1.5 -translate-x-1/2 absolute left-1/2 flex size-5 items-center justify-center rounded-full font-stats font-bold text-[11px] text-white",
															meta.badge,
														)}
													>
														{entry.rank}
													</span>
												</div>
												<p className="mt-3 max-w-full truncate text-center font-medium text-foreground text-xs sm:text-sm">
													{labelFor(entry)}
												</p>
												<p className="font-stats font-bold text-brand-primary text-sm sm:text-base">
													{entry.points.toLocaleString()}
												</p>
												<div
													className={cn(
														"mt-2 w-full rounded-t-card",
														meta.bar,
														meta.height,
													)}
												/>
											</motion.div>
										);
									})}
								</div>
							</section>

							{/* Your position */}
							{you ? (
								<section>
									<p className="mb-2 px-1 font-stats font-semibold text-muted-foreground text-xs uppercase tracking-wide">
										{t("leaderboard.your_position")}
									</p>
									<div className="flex items-center gap-3 rounded-card border-2 border-brand-primary/30 bg-brand-primary-light/40 p-4 shadow-card sm:gap-4">
										<span className="w-8 text-center font-stats font-bold text-brand-primary text-lg">
											{you.rank}
										</span>
										<Avatar
											name={you.name}
											image={isGroup ? undefined : user?.image}
											className="size-11 text-sm"
										/>
										<div className="min-w-0 flex-1">
											<p className="truncate font-display text-foreground">
												{labelFor(you)}
											</p>
											<p className="text-muted-foreground text-xs">
												{you.points.toLocaleString()} {t("leaderboard.pts")}
											</p>
										</div>
									</div>
								</section>
							) : null}

							{/* Ranked list (4th onward) */}
							<section className="space-y-2">
								{rest.map((entry, i) => (
									<motion.div
										key={entry.subjectId}
										initial={{ opacity: 0, x: -12 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ delay: 0.05 * i, duration: 0.3 }}
										className={cn(
											"flex items-center gap-3 rounded-card border p-3.5 sm:gap-4",
											entry.isYou
												? "border-brand-primary/30 bg-brand-primary-light/30"
												: "border-border bg-card shadow-card",
										)}
									>
										<span className="w-7 text-center font-stats font-bold text-muted-foreground text-sm">
											{entry.rank}
										</span>
										<Avatar
											name={entry.name}
											image={entry.isYou && !isGroup ? user?.image : undefined}
											className="size-10 text-sm"
										/>
										<div className="min-w-0 flex-1">
											<p className="truncate font-medium text-foreground text-sm">
												{labelFor(entry)}
											</p>
											<p className="font-stats text-muted-foreground text-xs">
												{entry.points.toLocaleString()} {t("leaderboard.pts")}
											</p>
										</div>
									</motion.div>
								))}
							</section>
						</motion.div>
					</AnimatePresence>
				)}
			</div>
		</LearnerShell>
	);
}
