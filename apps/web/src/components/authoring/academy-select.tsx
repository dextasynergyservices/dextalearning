import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getAcademies } from "@/lib/content-api";
import { cn } from "@/lib/utils";

/**
 * Academy (tenant) picker for authoring (§2.1). Chosen once when a course / path
 * / cohort is created; everything under it (lessons, assessments, projects)
 * inherits that academy. Both admins and instructors may pick any academy.
 */
export function AcademySelect({
	value,
	onChange,
	className,
	id,
}: {
	value: string;
	onChange: (slug: string) => void;
	className?: string;
	id?: string;
}) {
	const { t } = useTranslation("authoring");
	const { data: academies } = useQuery({
		queryKey: ["academies"],
		queryFn: getAcademies,
		staleTime: 5 * 60 * 1000,
	});

	return (
		<select
			id={id}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			aria-label={t("academy.label", { defaultValue: "Academy" })}
			className={cn(
				"h-11 rounded-input border border-border bg-card px-3 text-foreground text-sm outline-none focus:border-brand-primary",
				className,
			)}
		>
			{(academies ?? []).map((a) => (
				<option key={a.slug} value={a.slug}>
					{a.name}
				</option>
			))}
		</select>
	);
}
