import { createFileRoute, useRouter } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
	BookOpen,
	ChevronLeft,
	Clock3,
	MessageSquareText,
	PanelTop,
} from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { LearnerShell } from "@/components/layout/learner-shell";
import { LessonPlayer } from "@/components/player/lesson-player";

export const Route = createFileRoute("/lessons/$lessonId")({
	component: LessonPage,
});

function LessonPage() {
	const { lessonId } = Route.useParams();
	const router = useRouter();
	const { t } = useTranslation("dashboard");

	return (
		<LearnerShell title={t("lesson.title")}>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.28 }}
				className="space-y-4 pt-4 lg:space-y-6 lg:pt-7"
			>
				<motion.section
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.38 }}
					className="rounded-card border border-border bg-card p-4 shadow-card sm:p-5"
				>
					<div className="flex items-start gap-3">
						<button
							type="button"
							onClick={() => router.history.back()}
							aria-label={t("lesson.back")}
							className="flex size-10 shrink-0 items-center justify-center rounded-btn bg-muted text-foreground transition-colors hover:bg-brand-primary-light hover:text-brand-primary"
						>
							<ChevronLeft className="size-5" />
						</button>
						<div className="min-w-0 flex-1">
							<p className="font-stats font-semibold text-brand-primary text-xs uppercase">
								{t("lesson.eyebrow")}
							</p>
							<h1 className="mt-1 font-display text-2xl leading-tight text-foreground sm:text-3xl">
								{t("lesson.heading")}
							</h1>
							<p className="mt-1 max-w-2xl text-muted-foreground text-sm leading-relaxed">
								{t("lesson.body")}
							</p>
						</div>
					</div>

					<div className="mt-4 grid grid-cols-3 gap-2">
						<LessonCue icon={Clock3} label={t("lesson.cue_duration")} />
						<LessonCue
							icon={MessageSquareText}
							label={t("lesson.cue_transcript")}
						/>
						<LessonCue icon={BookOpen} label={t("lesson.cue_recall")} />
					</div>
				</motion.section>

				<motion.section
					initial={{ opacity: 0, y: 18 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.38, delay: 0.08 }}
					className="rounded-card border border-border bg-card p-2 shadow-card sm:p-3"
				>
					<LessonPlayer lessonId={lessonId} />
				</motion.section>

				<motion.section
					initial={{ opacity: 0, y: 18 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.38, delay: 0.16 }}
					className="rounded-card border border-brand-primary/20 bg-brand-primary-light p-4 sm:p-5"
				>
					<div className="flex items-start gap-3">
						<span className="flex size-10 shrink-0 items-center justify-center rounded-btn bg-card text-brand-primary">
							<PanelTop className="size-5" />
						</span>
						<div>
							<p className="font-display text-lg text-foreground">
								{t("lesson.tip_title")}
							</p>
							<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
								{t("lesson.tip_body")}
							</p>
						</div>
					</div>
				</motion.section>
			</motion.div>
		</LearnerShell>
	);
}

function LessonCue({
	icon: Icon,
	label,
}: {
	icon: ComponentType<{ className?: string }>;
	label: string;
}) {
	return (
		<div className="flex items-center gap-2 rounded-btn border border-border bg-muted px-3 py-2">
			<Icon className="size-4 shrink-0 text-brand-primary" />
			<span className="truncate font-stats font-semibold text-[0.68rem] text-muted-foreground uppercase">
				{label}
			</span>
		</div>
	);
}
