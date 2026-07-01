import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchFieldProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	className?: string;
}

export function SearchField({
	value,
	onChange,
	placeholder,
	className,
}: SearchFieldProps) {
	return (
		<div className={cn("relative", className)}>
			<Search className="-translate-y-1/2 absolute top-1/2 left-3.5 size-5 text-muted-foreground" />
			<input
				type="search"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				className="h-12 w-full rounded-input border border-border bg-card pr-10 pl-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
			/>
			{value ? (
				<button
					type="button"
					onClick={() => onChange("")}
					aria-label="Clear search"
					className="-translate-y-1/2 absolute top-1/2 right-2.5 flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				>
					<X className="size-4" />
				</button>
			) : null}
		</div>
	);
}
