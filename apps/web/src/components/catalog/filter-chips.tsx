import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface FilterChipsProps {
	items: readonly string[];
	active: string;
	onChange: (value: string) => void;
	/** Namespaced key prefix for chip labels, e.g. "categories". */
	labelPrefix: string;
}

/** Horizontally-scrollable filter chips — an app-style segmented filter row. */
export function FilterChips({
	items,
	active,
	onChange,
	labelPrefix,
}: FilterChipsProps) {
	const { t } = useTranslation("academy");

	return (
		<div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden">
			{items.map((key) => (
				<button
					key={key}
					type="button"
					onClick={() => onChange(key)}
					className={cn(
						"shrink-0 rounded-pill px-4 py-2 font-medium text-sm transition-all active:scale-95",
						active === key
							? "bg-brand-solid text-white shadow-sm"
							: "bg-muted text-muted-foreground hover:bg-accent",
					)}
				>
					{t(`${labelPrefix}.${key}`)}
				</button>
			))}
		</div>
	);
}
