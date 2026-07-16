import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
	value: string;
	label: string;
}

/**
 * Reusable searchable single-select (shadcn Popover + cmdk Command). Type to
 * filter; keyboard-navigable; native-app-friendly full-width menu. Used for the
 * bank picker and reusable anywhere a long list needs search.
 */
export function Combobox({
	options,
	value,
	onChange,
	placeholder = "Select…",
	searchPlaceholder = "Search…",
	emptyText = "No results.",
	disabled,
	className,
	id,
}: {
	options: ComboboxOption[];
	value: string | null;
	onChange: (value: string) => void;
	placeholder?: string;
	searchPlaceholder?: string;
	emptyText?: string;
	disabled?: boolean;
	className?: string;
	id?: string;
}) {
	const [open, setOpen] = useState(false);
	const selected = options.find((o) => o.value === value) ?? null;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					id={id}
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className={cn(
						"flex h-11 w-full items-center justify-between gap-2 rounded-btn border border-border bg-background px-3 text-left text-sm outline-none focus-visible:border-brand-primary disabled:opacity-50",
						className,
					)}
				>
					<span
						className={cn(
							"truncate",
							selected ? "text-foreground" : "text-muted-foreground",
						)}
					>
						{selected?.label ?? placeholder}
					</span>
					<ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
				</button>
			</PopoverTrigger>
			<PopoverContent className="p-0">
				<Command
					filter={(val, search) =>
						val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
					}
				>
					<CommandInput placeholder={searchPlaceholder} />
					<CommandList>
						<CommandEmpty>{emptyText}</CommandEmpty>
						<CommandGroup>
							{options.map((opt) => (
								<CommandItem
									key={opt.value}
									value={opt.label}
									onSelect={() => {
										onChange(opt.value);
										setOpen(false);
									}}
								>
									<span className="truncate">{opt.label}</span>
									{value === opt.value ? (
										<Check className="size-4 shrink-0 text-brand-primary" />
									) : null}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
