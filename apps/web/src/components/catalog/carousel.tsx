import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Horizontal swipe carousel for curated "shelves" (featured / recommended /
 * continue). Native scroll-snap so it feels like an app on mobile (cards peek +
 * snap); subtle prev/next arrows appear on desktop hover. For "browse
 * everything" surfaces use `PagedGrid` (vertical) instead.
 */
export function Carousel<T>({
	items,
	render,
	getKey,
	itemClassName = "w-[78%] sm:w-[46%] lg:w-[31%]",
}: {
	items: T[];
	render: (item: T) => ReactNode;
	getKey: (item: T) => string;
	/** Per-item width — controls how many cards show + how much the next peeks. */
	itemClassName?: string;
}) {
	const ref = useRef<HTMLDivElement>(null);

	const scrollByPage = (dir: 1 | -1) => {
		const el = ref.current;
		if (el)
			el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
	};

	return (
		<div className="group/carousel relative">
			<div
				ref={ref}
				className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
			>
				{items.map((item) => (
					<div
						key={getKey(item)}
						className={cn("shrink-0 snap-start", itemClassName)}
					>
						{render(item)}
					</div>
				))}
			</div>

			<button
				type="button"
				aria-label="Previous"
				onClick={() => scrollByPage(-1)}
				className="-left-4 -translate-y-1/2 absolute top-[40%] hidden size-9 items-center justify-center rounded-full border border-border bg-card text-foreground opacity-0 shadow-card transition-opacity hover:text-brand-primary group-hover/carousel:opacity-100 lg:flex"
			>
				<ChevronLeft className="size-5" />
			</button>
			<button
				type="button"
				aria-label="Next"
				onClick={() => scrollByPage(1)}
				className="-right-4 -translate-y-1/2 absolute top-[40%] hidden size-9 items-center justify-center rounded-full border border-border bg-card text-foreground opacity-0 shadow-card transition-opacity hover:text-brand-primary group-hover/carousel:opacity-100 lg:flex"
			>
				<ChevronRight className="size-5" />
			</button>
		</div>
	);
}
