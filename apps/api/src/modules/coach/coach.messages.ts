/**
 * Coach digest wrapper copy in all four platform languages (§11). The AI writes
 * the headline/message/action already localized by `user.language`; this only
 * covers the fixed chrome (email subject + CTA + section labels + WhatsApp
 * framing). Backend has no i18next — a small dictionary is the whole surface.
 */
export type CoachLanguage = "en" | "fr" | "es" | "pcm";

export function coachLanguageOf(
	language: string | null | undefined,
): CoachLanguage {
	return language === "fr" || language === "es" || language === "pcm"
		? language
		: "en";
}

export interface CoachChrome {
	subject: string;
	actionLabel: string;
	cta: string;
	/** Wraps the AI headline + action into one short WhatsApp line. */
	whatsapp: (headline: string, action: string) => string;
}

export const COACH_COPY: Record<CoachLanguage, CoachChrome> = {
	en: {
		subject: "Your weekly learning check-in 🌱",
		actionLabel: "This week's focus",
		cta: "Keep learning",
		whatsapp: (headline, action) => `${headline}\n\n👉 ${action}`,
	},
	fr: {
		subject: "Ton bilan d'apprentissage de la semaine 🌱",
		actionLabel: "Ton objectif de la semaine",
		cta: "Continuer à apprendre",
		whatsapp: (headline, action) => `${headline}\n\n👉 ${action}`,
	},
	es: {
		subject: "Tu resumen de aprendizaje semanal 🌱",
		actionLabel: "Tu enfoque de esta semana",
		cta: "Seguir aprendiendo",
		whatsapp: (headline, action) => `${headline}\n\n👉 ${action}`,
	},
	pcm: {
		subject: "Your weekly learning check-in 🌱",
		actionLabel: "Wetin to focus on dis week",
		cta: "Continue to learn",
		whatsapp: (headline, action) => `${headline}\n\n👉 ${action}`,
	},
};
