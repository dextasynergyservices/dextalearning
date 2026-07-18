import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

export const SUPPORTED_LANGUAGES = ["en", "fr", "es", "pcm"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

/**
 * Locale namespaces load LAZILY per language (§13.2). The old eager glob
 * bundled all four languages (~385KB raw) into the entry chunk — three of
 * them dead weight for every user on every visit. Now each `<lng>/<ns>.json`
 * is its own dynamic import: `main.tsx` awaits the detected language before
 * first render (so there is never a flash of translation keys), and switching
 * language in the profile fetches that language's chunks on demand.
 */
const localeModules = import.meta.glob<{ default: Record<string, string> }>(
	"../locales/**/*.json",
);

/** Namespace list, derived from the file tree at build time. */
const namespaces = Array.from(
	new Set(
		Object.keys(localeModules)
			.map((path) => path.match(/\/locales\/[^/]+\/([^/]+)\.json$/)?.[1])
			.filter((ns): ns is string => Boolean(ns)),
	),
);

/** i18next lazy backend: resolve one `<lng>/<ns>` bundle on request. */
const lazyBackend = {
	type: "backend" as const,
	init: () => {},
	read(
		lng: string,
		ns: string,
		callback: (err: unknown, data?: Record<string, string>) => void,
	) {
		const loader = localeModules[`../locales/${lng}/${ns}.json`];
		if (!loader) {
			callback(null, {}); // unknown combination — empty, fall back to en
			return;
		}
		loader().then(
			(mod) => callback(null, mod.default),
			(err) => callback(err),
		);
	},
};

void i18n
	.use(lazyBackend)
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		supportedLngs: [...SUPPORTED_LANGUAGES],
		fallbackLng: DEFAULT_LANGUAGE,
		defaultNS: "common",
		ns: namespaces,
		interpolation: { escapeValue: false },
		detection: {
			order: ["localStorage", "navigator", "htmlTag"],
			caches: ["localStorage"],
		},
		react: {
			// No Suspense: main.tsx awaits the initial language before rendering,
			// and later language switches re-render when their bundles land.
			useSuspense: false,
		},
	});

/**
 * Resolves when the ACTIVE language's namespaces are loaded — awaited in
 * main.tsx before the first render so no raw translation key ever paints.
 */
export const i18nReady: Promise<unknown> = new Promise((resolve) => {
	if (i18n.isInitialized) resolve(undefined);
	else i18n.on("initialized", resolve);
});

export default i18n;
