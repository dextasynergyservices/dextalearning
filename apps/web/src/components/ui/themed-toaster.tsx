import { Toaster } from "sonner";
import { useTheme } from "@/lib/theme";

/**
 * Sonner toaster wired to the app's theme store. Without an explicit `theme`
 * prop sonner always renders LIGHT toasts — washed out and low-contrast on a
 * dark UI. Our theme values ("light" | "dark" | "system") are exactly what
 * sonner accepts, and `useTheme` re-renders on toggle + live OS changes, so
 * toasts always match the surrounding chrome.
 */
export function ThemedToaster() {
	const { theme } = useTheme();
	return <Toaster position="top-center" richColors closeButton theme={theme} />;
}
