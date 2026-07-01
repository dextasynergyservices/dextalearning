import { Link } from "@tanstack/react-router";
import { CheckCircle2, GraduationCap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CommercialBadge } from "@/components/catalog/commercial-badge";
import type { MyLearningItem } from "@/lib/content-api";
import { cn } from "@/lib/utils";

/** Route + params for a learner-hub link — a distinct, correctly-shaped
 *  literal per entity type (mirrors `hubLinkProps` in routes/learn/mine.tsx). */
function hubLinkProps(item: MyLearningItem) {
	if (item.type === "course")
		return { to: "/learn/course/$courseId", params: { courseId: item.id } };
	if (item.type === "path")
		return { to: "/learn/path/$pathId", params: { pathId: item.id } };
	return { to: "/learn/cohort/$cohortId", params: { cohortId: item.id } };
}

/** Learner-owned content card → links to the in-app hub, with live progress. */
export function MyLearningCard({ item }: { item: MyLearningItem }) {
	const { t } = useTranslation("dashboard");

	return (
		<Link
			// biome-ignore lint/suspicious/noExplicitAny: route + param key vary by entity type.
			{...(hubLinkProps(item) as any)}
			className="group flex flex-col overflow-hidden rounded-card border border-border bg-card shadow-card transition-shadow hover:shadow-modal"
		>
			<div className="relative aspect-video bg-muted">
				{item.thumbnailUrl ? (
					<img
						src={item.thumbnailUrl}
						alt=""
						className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
					/>
				) : (
					<div className="flex size-full items-center justify-center bg-gradient-to-br from-brand-primary/20 to-brand-accent/20 text-brand-primary/50">
						<GraduationCap className="size-9" />
					</div>
				)}
				<CommercialBadge
					isFree={item.isFree}
					isEarnBackEligible={item.isEarnBackEligible}
					earnBackPercentage={item.earnBackPercentage}
					className="absolute top-2 right-2"
				/>
				{item.isComplete ? (
					<span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-success px-2 py-0.5 font-medium text-white text-xs">
						<CheckCircle2 className="size-3" />
						{t("my.completed", { defaultValue: "Completed" })}
					</span>
				) : null}
			</div>
			<div className="flex flex-1 flex-col p-3.5">
				<p className="font-stats font-semibold text-[0.65rem] text-brand-primary uppercase">
					{t(`my.type_${item.type}`, { defaultValue: item.type })}
				</p>
				<h3 className="mt-1 line-clamp-2 flex-1 font-display text-foreground text-sm leading-snug">
					{item.title}
				</h3>
				<div className="mt-3">
					<div className="h-1.5 overflow-hidden rounded-full bg-muted">
						<div
							className={cn(
								"h-full rounded-full",
								item.isComplete ? "bg-success" : "bg-brand-primary",
							)}
							style={{ width: `${item.percent}%` }}
						/>
					</div>
					<p className="mt-1 text-muted-foreground text-xs">
						{item.isComplete
							? t("my.done", { defaultValue: "Done" })
							: t("my.percent", { defaultValue: "{{n}}%", n: item.percent })}
					</p>
				</div>
			</div>
		</Link>
	);
}
