import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/")({
	component: HomePage,
});

function HomePage() {
	const { t } = useTranslation();

	return (
		<main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-hero-bg px-6 text-center">
			<h1 className="font-display text-5xl text-white sm:text-6xl">
				{t("app_name")}
			</h1>
			<p className="max-w-md font-sans text-lg text-slate-300">
				{t("tagline")}
			</p>
			<button type="button" className="btn-primary px-6 py-3 text-base">
				{t("get_started")}
			</button>
		</main>
	);
}
