import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Root error-boundary screen (§15). What a learner sees if the app itself
 * crashes — previously a permanent white page. Kept dependency-light on
 * purpose: this renders when something above it already failed, so the less
 * it needs (no router, no query client, no session), the more crashes it
 * survives. i18n is safe — it's initialised before render in main.tsx.
 */
export function ErrorBoundaryFallback({ onRetry }: { onRetry: () => void }) {
	const { t } = useTranslation("common");
	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
			<p className="font-display text-2xl text-foreground">
				{t("crash.title", { defaultValue: "Something went wrong" })}
			</p>
			<p className="max-w-sm text-muted-foreground text-sm">
				{t("crash.body", {
					defaultValue:
						"The error has been reported. Your progress is saved on our servers — nothing is lost.",
				})}
			</p>
			<button
				type="button"
				onClick={onRetry}
				className="inline-flex h-12 items-center gap-2 rounded-btn bg-brand-solid px-6 font-semibold text-sm text-white transition-colors hover:bg-brand-solid-hover"
			>
				<RefreshCw className="size-4" />
				{t("crash.retry", { defaultValue: "Try again" })}
			</button>
			<button
				type="button"
				onClick={() => window.location.assign("/")}
				className="text-muted-foreground text-sm underline-offset-4 hover:underline"
			>
				{t("crash.home", { defaultValue: "Go to the home page" })}
			</button>
		</div>
	);
}
