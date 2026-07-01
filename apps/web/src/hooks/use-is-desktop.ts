import { useEffect, useState } from "react";

/** `true` at the `lg` breakpoint (≥1024px) and up — for mobile-vs-desktop UI. */
export function useIsDesktop(): boolean {
	const [isDesktop, setIsDesktop] = useState(
		() =>
			typeof window !== "undefined" &&
			window.matchMedia("(min-width: 1024px)").matches,
	);
	useEffect(() => {
		const mq = window.matchMedia("(min-width: 1024px)");
		const update = () => setIsDesktop(mq.matches);
		update();
		mq.addEventListener("change", update);
		return () => mq.removeEventListener("change", update);
	}, []);
	return isDesktop;
}
