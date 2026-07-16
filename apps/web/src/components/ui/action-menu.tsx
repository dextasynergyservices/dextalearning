import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import { type ComponentType, useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

export interface ActionItem {
	key: string;
	label: string;
	icon: ComponentType<{ className?: string }>;
	onSelect: () => void;
	/** `danger` reserves the destructive tone — never for a routine action. */
	tone?: "default" | "danger";
	disabled?: boolean;
}

/**
 * An overflow (⋯) menu that is a dropdown on desktop and a native-style bottom
 * sheet on mobile.
 *
 * The two branches are separate DOM, not one tree restyled: a thumb-reachable
 * sheet with 48px rows, a drag handle and safe-area padding is a different
 * *interaction*, not a different width. Rendering both and hiding one with CSS
 * would also double the open-state and leak duplicate buttons into the
 * accessibility tree.
 */
export function ActionMenu({
	items,
	label,
	align = "end",
}: {
	items: ActionItem[];
	/** Accessible name for the trigger, e.g. "Actions for Amara Okafor". */
	label: string;
	align?: "start" | "end";
}) {
	const [open, setOpen] = useState(false);
	const isMobile = useIsMobile();
	const reduceMotion = useReducedMotion();

	if (items.length === 0) return null;

	const run = (item: ActionItem) => {
		setOpen(false);
		item.onSelect();
	};

	const trigger = (
		<button
			type="button"
			aria-label={label}
			aria-haspopup="menu"
			aria-expanded={open}
			onClick={isMobile ? () => setOpen(true) : undefined}
			className="flex size-9 items-center justify-center rounded-btn text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
		>
			<MoreHorizontal className="size-4" />
		</button>
	);

	if (!isMobile) {
		return (
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>{trigger}</PopoverTrigger>
				<PopoverContent align={align} className="w-56 p-1.5">
					<div role="menu" aria-label={label}>
						{items.map((item) => (
							<Row key={item.key} item={item} onRun={run} />
						))}
					</div>
				</PopoverContent>
			</Popover>
		);
	}

	return (
		<>
			{trigger}
			<AnimatePresence>
				{open ? (
					<div className="fixed inset-0 z-50 sm:hidden">
						<motion.button
							type="button"
							aria-label={label}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={() => setOpen(false)}
							className="absolute inset-0 cursor-default bg-black/40"
						/>
						<motion.div
							role="menu"
							aria-label={label}
							initial={reduceMotion ? false : { y: "100%" }}
							animate={{ y: 0 }}
							exit={reduceMotion ? undefined : { y: "100%" }}
							transition={{ type: "spring", stiffness: 400, damping: 40 }}
							drag={reduceMotion ? false : "y"}
							dragConstraints={{ top: 0, bottom: 0 }}
							dragElastic={{ top: 0, bottom: 0.6 }}
							onDragEnd={(_, info) => {
								// Flick down or drag past a third of the sheet to dismiss —
								// the gesture a native sheet answers to.
								if (info.offset.y > 80 || info.velocity.y > 500) setOpen(false);
							}}
							className="absolute inset-x-0 bottom-0 touch-none rounded-t-card border-border border-t bg-card p-3 shadow-modal"
							style={{
								paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
							}}
						>
							<div className="mx-auto mb-2 h-1.5 w-10 cursor-grab rounded-full bg-border active:cursor-grabbing" />
							{items.map((item) => (
								<Row key={item.key} item={item} onRun={run} mobile />
							))}
						</motion.div>
					</div>
				) : null}
			</AnimatePresence>
		</>
	);
}

function Row({
	item,
	onRun,
	mobile,
}: {
	item: ActionItem;
	onRun: (item: ActionItem) => void;
	mobile?: boolean;
}) {
	const Icon = item.icon;
	return (
		<button
			type="button"
			role="menuitem"
			disabled={item.disabled}
			onClick={() => onRun(item)}
			className={cn(
				"flex w-full items-center gap-3 rounded-btn text-left font-medium transition-colors disabled:opacity-40",
				// 48px rows on mobile: a thumb, not a cursor.
				mobile ? "px-3 py-3.5 text-base" : "px-2.5 py-2 text-sm",
				item.tone === "danger"
					? "text-destructive hover:bg-destructive/5"
					: "text-foreground hover:bg-accent",
			)}
		>
			<Icon
				className={cn(
					"shrink-0",
					mobile ? "size-5" : "size-4",
					item.tone === "danger" ? "" : "text-muted-foreground",
				)}
			/>
			{item.label}
		</button>
	);
}
