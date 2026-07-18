import { useSyncExternalStore } from "react";

/**
 * Live connectivity state. `navigator.onLine` is optimistic (it can say true
 * on a captive portal), but for our use — "should we warn, queue and retry?"
 * — false negatives are what matter, and those it reports reliably.
 */
function subscribe(onChange: () => void): () => void {
	window.addEventListener("online", onChange);
	window.addEventListener("offline", onChange);
	return () => {
		window.removeEventListener("online", onChange);
		window.removeEventListener("offline", onChange);
	};
}

export function useOnline(): boolean {
	return useSyncExternalStore(
		subscribe,
		() => navigator.onLine,
		() => true,
	);
}
