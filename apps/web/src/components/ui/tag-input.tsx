import { X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";

interface TagInputProps {
	value: string[];
	onChange: (tags: string[]) => void;
	/** Preset quick-add chips shown below the field; clicking adds `value`. */
	suggestions?: { value: string; label: string }[];
	/** Render a stored value as a display label (e.g. localise preset keys). */
	getLabel?: (value: string) => string;
	placeholder?: string;
	maxTags?: number;
}

/**
 * Tags/combobox input — type to add a custom tag (Enter / comma), or click a
 * preset suggestion. Backspace on an empty field removes the last tag.
 */
export function TagInput({
	value,
	onChange,
	suggestions = [],
	getLabel,
	placeholder,
	maxTags = 20,
}: TagInputProps) {
	const [draft, setDraft] = useState("");
	const label = (tag: string) => getLabel?.(tag) ?? tag;

	const add = (raw: string) => {
		const tag = raw.trim();
		setDraft("");
		if (!tag || value.length >= maxTags) return;
		if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) return;
		onChange([...value, tag]);
	};
	const remove = (tag: string) => onChange(value.filter((v) => v !== tag));

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter" || event.key === ",") {
			event.preventDefault();
			add(draft);
		} else if (event.key === "Backspace" && !draft && value.length > 0) {
			remove(value[value.length - 1]);
		}
	};

	const available = suggestions.filter(
		(s) => !value.some((v) => v.toLowerCase() === s.value.toLowerCase()),
	);

	return (
		<div>
			<div className="flex flex-wrap items-center gap-2 rounded-input border border-border bg-card px-2 py-2 transition-colors focus-within:border-brand-primary">
				{value.map((tag) => (
					<span
						key={tag}
						className="inline-flex items-center gap-1 rounded-pill bg-brand-primary-light py-1 pr-1.5 pl-3 font-medium text-brand-primary text-sm"
					>
						{label(tag)}
						<button
							type="button"
							onClick={() => remove(tag)}
							aria-label="Remove"
							className="flex size-4 items-center justify-center rounded-full transition-colors hover:bg-brand-primary/15"
						>
							<X className="size-3" />
						</button>
					</span>
				))}
				<input
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={onKeyDown}
					onBlur={() => add(draft)}
					placeholder={value.length === 0 ? placeholder : ""}
					className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-foreground text-sm outline-none placeholder:text-muted-foreground"
				/>
			</div>
			{available.length > 0 ? (
				<div className="mt-2 flex flex-wrap gap-1.5">
					{available.map((s) => (
						<button
							key={s.value}
							type="button"
							onClick={() => add(s.value)}
							className="rounded-pill border border-border px-2.5 py-1 text-muted-foreground text-xs transition-colors hover:border-brand-primary/40 hover:text-brand-primary"
						>
							+ {s.label}
						</button>
					))}
				</div>
			) : null}
		</div>
	);
}
