import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

interface AccordionItemProps {
	title: ReactNode;
	subtitle?: ReactNode;
	children: ReactNode;
	defaultOpen?: boolean;
}

/** Single collapsible row — used for curriculum modules and FAQs. */
export function AccordionItem({
	title,
	subtitle,
	children,
	defaultOpen = false,
}: AccordionItemProps) {
	const [open, setOpen] = useState(defaultOpen);

	return (
		<div className="border-slate-200 border-b">
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				aria-expanded={open}
				className="flex w-full items-center gap-3 py-4 text-left"
			>
				<span className="flex-1">
					<span className="block font-medium text-slate-900">{title}</span>
					{subtitle ? (
						<span className="mt-0.5 block text-slate-400 text-sm">
							{subtitle}
						</span>
					) : null}
				</span>
				<ChevronDown
					className={cn(
						"size-5 shrink-0 text-slate-400 transition-transform duration-200",
						open && "rotate-180",
					)}
				/>
			</button>
			<AnimatePresence initial={false}>
				{open ? (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.2, ease: "easeOut" }}
						className="overflow-hidden"
					>
						<div className="pb-4">{children}</div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
}
