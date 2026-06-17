import { Link } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Temporary branded scaffold for public pages whose full build lands in a later
 * Phase 1 slice. Reads its copy from the `pages` namespace by key so every
 * string is localized (en/fr/es/pcm).
 */
export function PagePlaceholder({ tKey }: { tKey: string }) {
	const { t } = useTranslation(["pages", "common"]);
	const eyebrow = t(`${tKey}.eyebrow`, {
		defaultValue: t("common:actions.coming_together"),
	});
	const description = t(`${tKey}.description`, { defaultValue: "" });

	return (
		<section className="mx-auto flex min-h-[62vh] max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
			<span className="flex size-14 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
				<Compass className="size-7" />
			</span>
			<p className="mt-6 font-stats text-sm font-semibold tracking-wider text-brand-primary uppercase">
				{eyebrow}
			</p>
			<h1 className="mt-3 font-display text-3xl tracking-tight text-slate-900 sm:text-4xl">
				{t(`${tKey}.title`)}
			</h1>
			{description ? (
				<p className="mt-4 text-lg text-slate-500">{description}</p>
			) : null}
			<Link
				to="/"
				className={cn(
					buttonVariants({ variant: "outline", size: "md" }),
					"mt-8",
				)}
			>
				{t("common:actions.back_home")}
			</Link>
		</section>
	);
}
