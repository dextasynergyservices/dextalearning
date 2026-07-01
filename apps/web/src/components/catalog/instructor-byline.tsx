import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { InstructorPublic } from "@/lib/content-api";
import { cn } from "@/lib/utils";

function initials(name: string): string {
	return (
		name
			.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? "")
			.join("") || "I"
	);
}

/** Localized expertise pills (labels reuse the onboarding `instructor.areas.*`). */
export function ExpertiseChips({ areas }: { areas: string[] }) {
	const { t } = useTranslation("onboarding");
	if (!areas?.length) return null;
	return (
		<div className="flex flex-wrap gap-2">
			{areas.map((area) => (
				<span
					key={area}
					className="rounded-pill bg-muted px-3 py-1 font-medium text-muted-foreground text-xs"
				>
					{t(`instructor.areas.${area}`, { defaultValue: area })}
				</span>
			))}
		</div>
	);
}

/** Avatar (image or initials) for an instructor. */
export function InstructorAvatar({
	instructor,
	className = "size-14",
}: {
	instructor: InstructorPublic;
	className?: string;
}) {
	return instructor.image ? (
		<img
			src={instructor.image}
			alt=""
			className={cn("rounded-full object-cover", className)}
		/>
	) : (
		<span
			className={cn(
				"flex items-center justify-center rounded-full bg-brand-primary font-display text-white",
				className,
			)}
		>
			{initials(instructor.name)}
		</span>
	);
}

/** "Your instructor" section for the course detail page. */
export function InstructorByline({
	instructor,
}: {
	instructor: InstructorPublic;
}) {
	const { t } = useTranslation("academy");
	return (
		<section className="rounded-card border border-border bg-card p-5 shadow-card sm:p-6">
			<p className="font-stats font-semibold text-brand-primary text-xs uppercase tracking-wide">
				{t("detail.instructor", { defaultValue: "Your instructor" })}
			</p>
			<div className="mt-4 flex items-start gap-4">
				<Link
					to="/instructors/$id"
					params={{ id: instructor.id }}
					className="shrink-0"
				>
					<InstructorAvatar instructor={instructor} />
				</Link>
				<div className="min-w-0 flex-1">
					<Link
						to="/instructors/$id"
						params={{ id: instructor.id }}
						className="font-display text-foreground text-lg transition-colors hover:text-brand-primary"
					>
						{instructor.name}
					</Link>
					{instructor.headline ? (
						<p className="text-muted-foreground text-sm">
							{instructor.headline}
						</p>
					) : null}
				</div>
			</div>
			{instructor.bio ? (
				<p className="mt-4 line-clamp-4 whitespace-pre-line text-muted-foreground text-sm leading-relaxed">
					{instructor.bio}
				</p>
			) : null}
			{instructor.expertiseAreas?.length ? (
				<div className="mt-4">
					<ExpertiseChips areas={instructor.expertiseAreas} />
				</div>
			) : null}
			<Link
				to="/instructors/$id"
				params={{ id: instructor.id }}
				className="mt-5 inline-flex items-center gap-1 font-semibold text-brand-primary text-sm transition-all hover:gap-1.5"
			>
				{t("detail.view_profile", { defaultValue: "View full profile" })}
				<ArrowRight className="size-4" />
			</Link>
		</section>
	);
}
