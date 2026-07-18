import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
	CheckCircle2,
	Compass,
	GraduationCap,
	Library,
	PlayCircle,
} from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Carousel } from "@/components/catalog/carousel";
import { CommercialBadge } from "@/components/catalog/commercial-badge";
import { LearnerShell } from "@/components/layout/learner-shell";
import { CertificatesSection } from "@/components/learn/certificates-section";
import { MyLearningCard } from "@/components/learn/my-learning-card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyLearning, type MyLearningItem } from "@/lib/content-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/learn/mine")({
	component: MyLearningPage,
});

function hubLinkProps(item: MyLearningItem) {
	if (item.type === "course")
		return { to: "/learn/course/$courseId", params: { courseId: item.id } };
	if (item.type === "path")
		return { to: "/learn/path/$pathId", params: { pathId: item.id } };
	return { to: "/learn/cohort/$cohortId", params: { cohortId: item.id } };
}

function MyLearningPage() {
	const { t } = useTranslation("dashboard");
	const { data, isPending } = useQuery({
		queryKey: ["my-learning"],
		queryFn: () => getMyLearning(),
	});

	const all: MyLearningItem[] = data
		? [...data.courses, ...data.paths, ...data.cohorts]
		: [];
	const inProgress = all.filter((i) => !i.isComplete);
	const completed = all.filter((i) => i.isComplete);

	return (
		<LearnerShell title={t("my.title", { defaultValue: "My Learning" })}>
			<div className="py-6">
				<header>
					<h1 className="font-display text-2xl text-foreground sm:text-3xl">
						{t("my.title", { defaultValue: "My Learning" })}
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						{t("my.subtitle", {
							defaultValue: "Pick up where you left off and track your wins.",
						})}
					</p>
				</header>

				{isPending ? (
					<div className="mt-6 space-y-6">
						<Skeleton className="h-44 rounded-card" />
						<div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
							<Skeleton className="h-56 rounded-card" />
							<Skeleton className="h-56 rounded-card" />
							<Skeleton className="h-56 rounded-card" />
						</div>
					</div>
				) : all.length === 0 ? (
					<EmptyState
						className="mt-8"
						icon={Library}
						title={t("my.empty_title", { defaultValue: "Nothing here yet" })}
						description={t("my.empty", {
							defaultValue:
								"Start a course and it'll show up here so you can continue anytime.",
						})}
						action={
							<Link
								to="/teachers/courses"
								className={cn(buttonVariants({ variant: "primary" }))}
							>
								<Compass className="size-4" />
								{t("my.browse", { defaultValue: "Browse courses" })}
							</Link>
						}
					/>
				) : (
					<>
						<div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
							<StatChip
								icon={PlayCircle}
								value={inProgress.length}
								label={t("my.in_progress", {
									defaultValue: "Continue learning",
								})}
								tint="bg-brand-primary-light text-brand-primary"
							/>
							<StatChip
								icon={CheckCircle2}
								value={completed.length}
								label={t("my.completed_section", { defaultValue: "Completed" })}
								tint="bg-success/10 text-success"
							/>
						</div>

						{inProgress[0] ? (
							<div className="mt-6">
								<ContinueHero item={inProgress[0]} />
							</div>
						) : null}

						<div className="mt-8 space-y-8">
							{inProgress.length > 1 ? (
								<Section
									title={t("my.more_in_progress", {
										defaultValue: "More in progress",
									})}
									items={inProgress.slice(1)}
									carousel
								/>
							) : null}
							{completed.length > 0 ? (
								<Section
									title={t("my.completed_section", {
										defaultValue: "Completed",
									})}
									items={completed}
								/>
							) : null}
							<CertificatesSection />
						</div>
					</>
				)}
			</div>
		</LearnerShell>
	);
}

function ContinueHero({ item }: { item: MyLearningItem }) {
	const { t } = useTranslation("dashboard");
	return (
		<Link
			// biome-ignore lint/suspicious/noExplicitAny: route + param key vary by entity type.
			{...(hubLinkProps(item) as any)}
			className="group grid overflow-hidden rounded-card border border-border bg-card shadow-card transition-shadow hover:shadow-modal sm:grid-cols-[300px_1fr]"
		>
			<div className="relative aspect-video bg-muted sm:aspect-auto">
				{item.thumbnailUrl ? (
					<img
						src={item.thumbnailUrl}
						alt=""
						className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
					/>
				) : (
					<div className="flex size-full items-center justify-center bg-gradient-to-br from-brand-primary/20 to-brand-accent/20 text-brand-primary/50">
						<GraduationCap className="size-10" />
					</div>
				)}
				<CommercialBadge
					isFree={item.isFree}
					isEarnBackEligible={item.isEarnBackEligible}
					earnBackPercentage={item.earnBackPercentage}
					className="absolute top-3 right-3"
				/>
			</div>
			<div className="flex flex-col justify-center p-5 sm:p-6">
				<p className="font-stats font-semibold text-brand-primary text-xs uppercase tracking-wide">
					{t("my.resume", { defaultValue: "Pick up where you left off" })}
				</p>
				<h3 className="mt-1 font-display text-foreground text-xl leading-tight sm:text-2xl">
					{item.title}
				</h3>
				<div className="mt-4 flex items-center gap-3">
					<div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-brand-solid transition-all"
							style={{ width: `${item.percent}%` }}
						/>
					</div>
					<span className="font-stats font-semibold text-muted-foreground text-sm">
						{item.percent}%
					</span>
				</div>
				<span className="mt-4 inline-flex w-fit items-center gap-2 rounded-btn bg-brand-solid px-4 py-2 font-semibold text-sm text-white transition-colors group-hover:bg-brand-solid-hover">
					<PlayCircle className="size-4" />
					{t("my.continue", { defaultValue: "Continue" })}
				</span>
			</div>
		</Link>
	);
}

function StatChip({
	icon: Icon,
	value,
	label,
	tint,
}: {
	icon: ComponentType<{ className?: string }>;
	value: number;
	label: string;
	tint: string;
}) {
	return (
		<div className="flex items-center gap-3 rounded-card border border-border bg-card p-3 shadow-card">
			<span
				className={cn(
					"flex size-10 shrink-0 items-center justify-center rounded-btn",
					tint,
				)}
			>
				<Icon className="size-5" />
			</span>
			<div className="min-w-0">
				<p className="font-stats font-bold text-foreground text-xl leading-none">
					{value}
				</p>
				<p className="mt-1 truncate text-muted-foreground text-xs">{label}</p>
			</div>
		</div>
	);
}

function Section({
	title,
	items,
	carousel,
}: {
	title: string;
	items: MyLearningItem[];
	carousel?: boolean;
}) {
	return (
		<section>
			<div className="mb-3 flex items-center gap-2">
				<h2 className="font-display text-lg text-foreground">{title}</h2>
				<span className="rounded-pill bg-muted px-2 py-0.5 font-stats font-semibold text-muted-foreground text-xs">
					{items.length}
				</span>
			</div>
			{carousel ? (
				<Carousel
					items={items}
					getKey={(item) => `${item.type}-${item.id}`}
					itemClassName="w-[72%] sm:w-[46%] lg:w-[31%]"
					render={(item) => <MyLearningCard item={item} />}
				/>
			) : (
				<div
					className={
						items.length === 1
							? "max-w-xs"
							: "grid grid-cols-2 gap-4 lg:grid-cols-3"
					}
				>
					{items.map((item, i) => (
						<motion.div
							key={`${item.type}-${item.id}`}
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
						>
							<MyLearningCard item={item} />
						</motion.div>
					))}
				</div>
			)}
		</section>
	);
}
