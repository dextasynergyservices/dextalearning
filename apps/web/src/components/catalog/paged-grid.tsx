import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

function useIsDesktop() {
	const [desktop, setDesktop] = useState(
		() =>
			typeof window !== "undefined" &&
			window.matchMedia("(min-width: 1024px)").matches,
	);
	useEffect(() => {
		const mq = window.matchMedia("(min-width: 1024px)");
		const on = () => setDesktop(mq.matches);
		mq.addEventListener("change", on);
		return () => mq.removeEventListener("change", on);
	}, []);
	return desktop;
}

/**
 * Catalogue/search list. Mobile has no footer, so it uses **infinite scroll**
 * (a sentinel auto-loads the next page); desktop uses an explicit **"Load more"**
 * button so the footer stays reachable. Windows client-side — no backend paging.
 */
export function PagedGrid<T>({
	items,
	render,
	getKey,
	resetKey,
	pageSize = 9,
	className,
}: {
	items: T[];
	render: (item: T) => ReactNode;
	getKey: (item: T) => string;
	/** Change this (e.g. the active search/filter) to reset back to page one. */
	resetKey?: string | number;
	pageSize?: number;
	className?: string;
}) {
	const { t } = useTranslation("academy");
	const isDesktop = useIsDesktop();
	const [visible, setVisible] = useState(pageSize);
	const sentinelRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset to page one whenever the filter/search changes.
	useEffect(() => {
		setVisible(pageSize);
	}, [resetKey, pageSize]);

	const hasMore = visible < items.length;

	useEffect(() => {
		if (isDesktop || !hasMore) return;
		const el = sentinelRef.current;
		if (!el) return;
		const obs = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting))
					setVisible((v) => v + pageSize);
			},
			{ rootMargin: "400px" },
		);
		obs.observe(el);
		return () => obs.disconnect();
	}, [isDesktop, hasMore, pageSize]);

	return (
		<>
			<div className={className}>
				{items.slice(0, visible).map((item) => (
					<Fragment key={getKey(item)}>{render(item)}</Fragment>
				))}
			</div>

			{hasMore && !isDesktop ? <div ref={sentinelRef} className="h-8" /> : null}

			{hasMore && isDesktop ? (
				<div className="mt-6 flex justify-center">
					<Button
						variant="outline"
						onClick={() => setVisible((v) => v + pageSize)}
					>
						{t("catalog.load_more", { defaultValue: "Load more" })}
					</Button>
				</div>
			) : null}
		</>
	);
}
