import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, GraduationCap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAcademies } from "@/lib/content-api";
import { cn } from "@/lib/utils";

/**
 * Academy entry point (§2.1). On global pages it's an "Academies" dropdown so the
 * user picks an academy rather than the chrome silently defaulting to one; inside
 * an academy (`current` set) it becomes that academy's switcher, labelled with the
 * current academy and letting you hop to another. Closes on outside-click/Escape.
 */
export function AcademyMenu({
	current,
	onDark = false,
}: {
	/** The current academy slug when inside `/:academy/*`; omitted on global pages. */
	current?: string;
	onDark?: boolean;
}) {
	const { t } = useTranslation("common");
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const { data: academies } = useQuery({
		queryKey: ["academies"],
		queryFn: getAcademies,
		staleTime: 5 * 60 * 1000,
	});

	useEffect(() => {
		if (!open) return;
		const onPointer = (e: MouseEvent) => {
			if (!ref.current?.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
		document.addEventListener("mousedown", onPointer);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onPointer);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const currentName = academies?.find((a) => a.slug === current)?.name;
	const label =
		currentName ?? t("nav.academies", { defaultValue: "Academies" });

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-haspopup="menu"
				aria-expanded={open}
				className={cn(
					"flex items-center gap-1.5 rounded-btn px-3.5 py-2 font-medium text-sm transition-colors",
					onDark
						? "text-slate-200 hover:bg-white/10 hover:text-white"
						: "text-muted-foreground hover:bg-accent hover:text-foreground",
				)}
			>
				<GraduationCap className="size-4" />
				{label}
				<ChevronDown
					className={cn("size-3.5 transition-transform", open && "rotate-180")}
				/>
			</button>

			{open ? (
				<div className="absolute left-0 z-50 mt-1.5 w-60 overflow-hidden rounded-card border border-border bg-popover py-1.5 shadow-card-hover">
					<p className="px-3 py-1 font-stats font-semibold text-muted-foreground text-xs uppercase tracking-wide">
						{t("nav.academies", { defaultValue: "Academies" })}
					</p>
					{(academies ?? []).map((a) => (
						<Link
							key={a.slug}
							to="/$academy"
							params={{ academy: a.slug }}
							onClick={() => setOpen(false)}
							className="flex items-center justify-between gap-2 px-3 py-2.5 text-foreground text-sm transition-colors hover:bg-accent"
						>
							{a.name}
							{a.slug === current ? (
								<Check className="size-4 text-brand-primary" />
							) : null}
						</Link>
					))}
				</div>
			) : null}
		</div>
	);
}
