import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LANGUAGE_LABELS: Record<string, string> = {
	en: "English",
	fr: "Français",
	es: "Español",
	pcm: "Naijá",
};

const LANGUAGE_SHORT: Record<string, string> = {
	en: "EN",
	fr: "FR",
	es: "ES",
	pcm: "PCM",
};

interface LanguageSwitcherProps {
	className?: string;
	/** Icon + short code, no border — for the mobile app bar. */
	compact?: boolean;
	/** Light styling for dark surfaces. */
	onDark?: boolean;
}

export function LanguageSwitcher({
	className,
	compact = false,
	onDark = false,
}: LanguageSwitcherProps) {
	const { i18n } = useTranslation();

	if (compact) {
		return (
			<label
				className={cn(
					"flex h-10 items-center gap-1 rounded-full px-2 transition-colors active:scale-95",
					onDark
						? "text-white hover:bg-white/10"
						: "text-muted-foreground hover:bg-accent",
					className,
				)}
			>
				<Globe className="size-5" />
				<span className="sr-only">Language</span>
				<select
					value={i18n.resolvedLanguage}
					onChange={(event) => {
						void i18n.changeLanguage(event.target.value);
					}}
					className="cursor-pointer appearance-none bg-transparent pr-0.5 font-stats font-medium text-xs outline-none"
				>
					{SUPPORTED_LANGUAGES.map((lng) => (
						<option key={lng} value={lng} className="text-foreground">
							{LANGUAGE_SHORT[lng] ?? lng}
						</option>
					))}
				</select>
			</label>
		);
	}

	return (
		<label
			className={cn(
				"inline-flex items-center gap-2 rounded-btn border border-border bg-card px-3 py-1.5 text-muted-foreground text-sm transition-colors focus-within:border-brand-primary",
				className,
			)}
		>
			<Globe className="size-4 text-muted-foreground" />
			<span className="sr-only">Language</span>
			<select
				value={i18n.resolvedLanguage}
				onChange={(event) => {
					void i18n.changeLanguage(event.target.value);
				}}
				className="cursor-pointer bg-transparent font-medium outline-none"
			>
				{SUPPORTED_LANGUAGES.map((lng) => (
					<option key={lng} value={lng}>
						{LANGUAGE_LABELS[lng] ?? lng}
					</option>
				))}
			</select>
		</label>
	);
}
