import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { badgeMetaOf } from "@/components/engagement/badge-meta";
import type { EarnedBadge } from "@/lib/engagement-api";
import { cn } from "@/lib/utils";

/**
 * "Your awards" grid (§3.2 goal gradient): every badge in the catalogue is
 * visible — earned ones in colour with their date, locked ones greyed with
 * the criteria as the hint of what to do next.
 */
export function BadgeGrid({
	badges,
	allKeys,
	className,
}: {
	badges: EarnedBadge[];
	allKeys: string[];
	className?: string;
}) {
	const { t, i18n } = useTranslation("engagement");
	const earnedByKey = new Map(badges.map((b) => [b.key, b]));
	const dateFormat = new Intl.DateTimeFormat(i18n.language, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});

	return (
		<section
			data-testid="badge-grid"
			className={cn(
				"rounded-card border border-border bg-card p-5 shadow-card",
				className,
			)}
		>
			<div className="flex items-baseline justify-between gap-3">
				<div>
					<h3 className="font-display text-foreground text-lg">
						{t("badges.title")}
					</h3>
					<p className="mt-0.5 text-muted-foreground text-sm">
						{t("badges.subtitle")}
					</p>
				</div>
				<p className="shrink-0 font-stats font-semibold text-brand-primary text-sm">
					{t("badges.earned_count", {
						earned: badges.length,
						total: allKeys.length,
					})}
				</p>
			</div>

			<ul className="mt-5 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
				{allKeys.map((key) => {
					const earned = earnedByKey.get(key);
					const { icon: Icon, tint } = badgeMetaOf(key);
					return (
						<li key={key} className="flex flex-col items-center text-center">
							<span
								className={cn(
									"relative flex size-14 items-center justify-center rounded-full",
									earned
										? cn(tint, "text-white shadow-card")
										: "bg-muted text-muted-foreground/60",
								)}
							>
								<Icon className="size-6" />
								{!earned ? (
									<span
										role="img"
										aria-label={t("badges.locked")}
										className="-right-0.5 -bottom-0.5 absolute flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
									>
										<Lock className="size-3" />
									</span>
								) : null}
							</span>
							<p
								className={cn(
									"mt-2 font-medium text-xs",
									earned ? "text-foreground" : "text-muted-foreground",
								)}
							>
								{t(`badges.${key}.name`)}
							</p>
							<p className="mt-0.5 text-[0.65rem] text-muted-foreground leading-tight">
								{earned
									? t("badges.earned_on", {
											date: dateFormat.format(new Date(earned.awardedAt)),
										})
									: t(`badges.${key}.desc`)}
							</p>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
