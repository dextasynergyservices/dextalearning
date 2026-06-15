import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

export const SUPPORTED_LANGUAGES = ["en", "fr", "es", "pcm"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

// Eagerly bundle every locale namespace JSON under src/locales so the four
// languages (EN | FR | ES | PCM) are available from day one without a network
// round-trip. Files are keyed as `<lng>/<namespace>`.
const localeModules = import.meta.glob<{ default: Record<string, string> }>(
	"../locales/**/*.json",
	{ eager: true },
);

const resources: Record<string, Record<string, Record<string, string>>> = {};
for (const [path, mod] of Object.entries(localeModules)) {
	const match = path.match(/\/locales\/([^/]+)\/([^/]+)\.json$/);
	if (!match) continue;
	const [, lng, ns] = match;
	if (!resources[lng]) {
		resources[lng] = {};
	}
	resources[lng][ns] = mod.default;
}

const namespaces = Array.from(
	new Set(Object.values(resources).flatMap((nsMap) => Object.keys(nsMap))),
);

void i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources,
		supportedLngs: [...SUPPORTED_LANGUAGES],
		fallbackLng: DEFAULT_LANGUAGE,
		defaultNS: "common",
		ns: namespaces,
		interpolation: { escapeValue: false },
		detection: {
			order: ["localStorage", "navigator", "htmlTag"],
			caches: ["localStorage"],
		},
	});

export default i18n;
