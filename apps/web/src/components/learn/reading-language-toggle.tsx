import { Languages, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReadingLang } from "@/hooks/use-reading-translation";

const OPTIONS: { value: ReadingLang; label: string }[] = [
	{ value: "original", label: "Original" },
	{ value: "en", label: "English" },
	{ value: "fr", label: "Français" },
	{ value: "es", label: "Español" },
	{ value: "pcm", label: "Naijá" },
];

/**
 * "Read in" picker for the translation layer (§11). Lets a learner read content
 * in a language they understand; grading is unaffected. Defaults to Original so
 * it costs nothing unless explicitly used.
 */
export function ReadingLanguageToggle({
	lang,
	setLang,
	loading,
}: {
	lang: ReadingLang;
	setLang: (l: ReadingLang) => void;
	loading: boolean;
}) {
	const { t } = useTranslation("authoring");
	return (
		<label className="inline-flex items-center gap-1.5 rounded-btn border border-border bg-card px-2.5 py-1.5 text-muted-foreground text-xs shadow-card">
			{loading ? (
				<Loader2 className="size-3.5 animate-spin text-brand-primary" />
			) : (
				<Languages className="size-3.5 text-muted-foreground" />
			)}
			<span className="hidden font-medium sm:inline">
				{t("play.read_in", { defaultValue: "Read in" })}
			</span>
			<select
				value={lang}
				onChange={(e) => setLang(e.target.value as ReadingLang)}
				className="cursor-pointer bg-transparent font-medium text-foreground outline-none"
				aria-label={t("play.read_in", { defaultValue: "Read in" })}
			>
				{OPTIONS.map((o) => (
					<option key={o.value} value={o.value}>
						{o.value === "original"
							? t("play.read_original", { defaultValue: "Original" })
							: o.label}
					</option>
				))}
			</select>
		</label>
	);
}
