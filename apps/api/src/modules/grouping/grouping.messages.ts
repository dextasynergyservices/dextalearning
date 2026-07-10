/**
 * Group-reassignment copy in all four platform languages (§8.6 "Group
 * reassigned" → email + WhatsApp + in-app; localized by `user.language`). The
 * backend has no i18next — this small dictionary is the whole surface. WhatsApp
 * strings stay short and in the blueprint's own voice.
 */
export type GroupingLanguage = "en" | "fr" | "es" | "pcm";

export function groupingLanguageOf(
	language: string | null | undefined,
): GroupingLanguage {
	return language === "fr" || language === "es" || language === "pcm"
		? language
		: "en";
}

export interface GroupAssignmentContext {
	firstName: string;
	cohortTitle: string;
	groupName: string;
}

interface GroupAssignmentCopy {
	subject: (c: GroupAssignmentContext) => string;
	heading: (c: GroupAssignmentContext) => string;
	body: (c: GroupAssignmentContext) => string;
	cta: string;
	whatsapp: (c: GroupAssignmentContext) => string;
}

export const GROUP_ASSIGNMENT_COPY: Record<
	GroupingLanguage,
	GroupAssignmentCopy
> = {
	en: {
		subject: (c) => `You're now in ${c.groupName} — ${c.cohortTitle}`,
		heading: (c) => `Hey ${c.firstName}, meet your new group`,
		body: (c) =>
			`You've been placed in ${c.groupName} for ${c.cohortTitle}. Say hi to your teammates and start learning together.`,
		cta: "Open your group",
		whatsapp: (c) =>
			`👥 ${c.firstName}, you're now in ${c.groupName} for ${c.cohortTitle}. Meet your team → dextalearning.com/dashboard`,
	},
	fr: {
		subject: (c) =>
			`Vous êtes maintenant dans ${c.groupName} — ${c.cohortTitle}`,
		heading: (c) => `Bonjour ${c.firstName}, voici votre nouveau groupe`,
		body: (c) =>
			`Vous avez été placé(e) dans ${c.groupName} pour ${c.cohortTitle}. Dites bonjour à votre équipe et apprenez ensemble.`,
		cta: "Ouvrir votre groupe",
		whatsapp: (c) =>
			`👥 ${c.firstName}, vous êtes dans ${c.groupName} pour ${c.cohortTitle}. Rencontrez votre équipe → dextalearning.com/dashboard`,
	},
	es: {
		subject: (c) => `Ahora estás en ${c.groupName} — ${c.cohortTitle}`,
		heading: (c) => `Hola ${c.firstName}, este es tu nuevo grupo`,
		body: (c) =>
			`Te hemos asignado a ${c.groupName} en ${c.cohortTitle}. Saluda a tu equipo y aprendan juntos.`,
		cta: "Abrir tu grupo",
		whatsapp: (c) =>
			`👥 ${c.firstName}, ahora estás en ${c.groupName} de ${c.cohortTitle}. Conoce a tu equipo → dextalearning.com/dashboard`,
	},
	pcm: {
		subject: (c) => `You dey ${c.groupName} now — ${c.cohortTitle}`,
		heading: (c) => `How far ${c.firstName}, meet your new group`,
		body: (c) =>
			`Dem don put you for ${c.groupName} for ${c.cohortTitle}. Greet your team make una start learn together.`,
		cta: "Open your group",
		whatsapp: (c) =>
			`👥 ${c.firstName}, you dey ${c.groupName} now for ${c.cohortTitle}. Meet your team → dextalearning.com/dashboard`,
	},
};
