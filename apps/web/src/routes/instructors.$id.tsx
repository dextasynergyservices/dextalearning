import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, GraduationCap } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
	ExpertiseChips,
	InstructorAvatar,
} from "@/components/catalog/instructor-byline";
import {
	PublicCohortCard,
	PublicCourseCard,
	PublicPathCard,
} from "@/components/catalog/public-cards";
import { PublicShell } from "@/components/layout/public-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getInstructor } from "@/lib/content-api";

function ContentSection({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<section>
			<h2 className="mb-4 font-display text-xl text-foreground sm:text-2xl">
				{title}
			</h2>
			<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
		</section>
	);
}

export const Route = createFileRoute("/instructors/$id")({
	component: InstructorProfilePage,
});

function InstructorProfilePage() {
	const { id } = Route.useParams();
	const { t } = useTranslation("academy");
	const { data, isPending, isError } = useQuery({
		queryKey: ["instructor", id],
		queryFn: () => getInstructor(id),
	});

	return (
		<PublicShell
			mobileTitle={t("detail.instructor", { defaultValue: "Instructor" })}
		>
			<div className="mx-auto max-w-7xl px-4 pt-20 pb-16 lg:px-8 lg:pt-28">
				{isPending ? (
					<div className="space-y-6">
						<Skeleton className="h-40 rounded-card" />
						<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
							{["a", "b", "c"].map((k) => (
								<Skeleton key={k} className="h-48 rounded-card" />
							))}
						</div>
					</div>
				) : isError || !data ? (
					<EmptyState
						className="my-12"
						icon={GraduationCap}
						title={t("detail.instructor_missing_title", {
							defaultValue: "Instructor not found",
						})}
						description={t("detail.instructor_missing_body", {
							defaultValue: "This instructor profile isn't available.",
						})}
					/>
				) : (
					<>
						{/* Profile hero */}
						<section className="flex flex-col items-center gap-5 rounded-card border border-border bg-card p-6 text-center shadow-card sm:flex-row sm:items-start sm:p-8 sm:text-left">
							<InstructorAvatar
								instructor={data.instructor}
								className="size-24 text-2xl"
							/>
							<div className="min-w-0 flex-1">
								<h1 className="font-display text-2xl tracking-tight text-foreground sm:text-3xl">
									{data.instructor.name}
								</h1>
								{data.instructor.headline ? (
									<p className="mt-1 text-brand-primary">
										{data.instructor.headline}
									</p>
								) : null}
								{data.instructor.bio ? (
									<p className="mt-4 whitespace-pre-line text-muted-foreground leading-relaxed">
										{data.instructor.bio}
									</p>
								) : null}
								{data.instructor.expertiseAreas?.length ? (
									<div className="mt-5 flex justify-center sm:justify-start">
										<ExpertiseChips areas={data.instructor.expertiseAreas} />
									</div>
								) : null}
							</div>
						</section>

						{/* Authored content — courses, paths, cohorts */}
						{data.courses.length + data.paths.length + data.cohorts.length ===
						0 ? (
							<EmptyState
								className="mt-10"
								icon={BookOpen}
								title={t("detail.no_content_title", {
									defaultValue: "Nothing published yet",
								})}
								description={t("detail.no_content_body", {
									defaultValue: "Check back soon for new content.",
								})}
							/>
						) : (
							<div className="mt-10 space-y-10">
								{data.courses.length > 0 ? (
									<ContentSection
										title={t("detail.courses_by", {
											defaultValue: "Courses by {{name}}",
											name: data.instructor.name,
										})}
									>
										{data.courses.map((course) => (
											<PublicCourseCard key={course.id} course={course} />
										))}
									</ContentSection>
								) : null}
								{data.paths.length > 0 ? (
									<ContentSection
										title={t("detail.paths_by", {
											defaultValue: "Paths by {{name}}",
											name: data.instructor.name,
										})}
									>
										{data.paths.map((path) => (
											<PublicPathCard key={path.id} path={path} />
										))}
									</ContentSection>
								) : null}
								{data.cohorts.length > 0 ? (
									<ContentSection
										title={t("detail.cohorts_by", {
											defaultValue: "Cohorts by {{name}}",
											name: data.instructor.name,
										})}
									>
										{data.cohorts.map((cohort) => (
											<PublicCohortCard key={cohort.id} cohort={cohort} />
										))}
									</ContentSection>
								) : null}
							</div>
						)}
					</>
				)}
			</div>
		</PublicShell>
	);
}
