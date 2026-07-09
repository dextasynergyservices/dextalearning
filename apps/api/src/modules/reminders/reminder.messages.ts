import type { StreakLineKind } from "./reminder.calculator";

/**
 * Reminder copy in all four platform languages (§11 — pcm is first-class;
 * user decision 2026-07-06: reminders localize by `user.language`). The
 * backend has no i18next — a small dictionary is the whole surface. WhatsApp
 * strings stay short (Termii pay-as-you-go) and in the blueprint's own voice.
 *
 * §3.1 upgrades (2026-07-07): every digest LEADS with a free-recall
 * challenge (testing effect — the reminder is itself a retrieval event); a
 * broken streak gets fresh-start framing instead of loss aversion; and when
 * the learner anchored study to a daily habit, the copy references the
 * anchor, not just the clock.
 */
export type ReminderLanguage = "en" | "fr" | "es" | "pcm";

export function reminderLanguageOf(
	language: string | null | undefined,
): ReminderLanguage {
	return language === "fr" || language === "es" || language === "pcm"
		? language
		: "en";
}

/** Habit-stacking anchor keys (§3.1) — mirror the onboarding wizard's options. */
export const STUDY_ANCHORS = [
	"morning_routine",
	"commute",
	"lunch_break",
	"after_work",
	"before_bed",
] as const;
export type StudyAnchor = (typeof STUDY_ANCHORS)[number];

const ANCHOR_PHRASES: Record<ReminderLanguage, Record<StudyAnchor, string>> = {
	en: {
		morning_routine: "after your morning routine",
		commute: "on your commute",
		lunch_break: "during your lunch break",
		after_work: "after work",
		before_bed: "before bed",
	},
	fr: {
		morning_routine: "après votre routine du matin",
		commute: "pendant votre trajet",
		lunch_break: "à la pause déjeuner",
		after_work: "après le travail",
		before_bed: "avant de dormir",
	},
	es: {
		morning_routine: "después de tu rutina matinal",
		commute: "en el trayecto",
		lunch_break: "en la pausa del almuerzo",
		after_work: "después del trabajo",
		before_bed: "antes de dormir",
	},
	pcm: {
		morning_routine: "after your morning runs",
		commute: "as you dey go road",
		lunch_break: "for lunch break",
		after_work: "after work",
		before_bed: "before you sleep",
	},
};

export function anchorPhraseOf(
	anchor: string | null | undefined,
	language: ReminderLanguage,
): string | null {
	if (!anchor) return null;
	const phrases = ANCHOR_PHRASES[language] as Record<string, string>;
	return phrases[anchor] ?? null;
}

export interface DigestContext {
	firstName: string;
	streakKind: StreakLineKind;
	streakCurrent: number;
	reviewTitles: string[];
	/** Lesson title for the free-recall challenge (top due review). */
	recallTitle: string | null;
	/** Pre-localized habit-anchor phrase ("after dinner"), when set. */
	anchorPhrase: string | null;
}

interface DigestCopy {
	subject: (ctx: DigestContext) => string;
	heading: (ctx: DigestContext) => string;
	/** §3.1 testing effect — free recall, deliberately NO answer options. */
	recallLine: (ctx: DigestContext) => string;
	streakLine: (ctx: DigestContext) => string;
	reviewsIntro: (ctx: DigestContext) => string;
	cta: string;
	whatsapp: (ctx: DigestContext) => string;
}

/** Trailing anchor sentence for WhatsApp, "" when no anchor is set. */
function anchorTail(
	ctx: DigestContext,
	template: (phrase: string) => string,
): string {
	return ctx.anchorPhrase ? ` ${template(ctx.anchorPhrase)}` : "";
}

/** The same anchor sentence placed mid-message (trailing space, no lead). */
function anchorMid(tail: string): string {
	return tail === "" ? "" : `${tail.trim()} `;
}

export const DIGEST_COPY: Record<ReminderLanguage, DigestCopy> = {
	en: {
		subject: (c) =>
			c.streakKind === "at_risk"
				? `Don't break your ${c.streakCurrent}-day streak, ${c.firstName}! 🔥`
				: c.streakKind === "fresh_start"
					? `Fresh start today, ${c.firstName} 🌱`
					: "Time for a quick review 📚",
		heading: (c) =>
			c.streakKind === "fresh_start"
				? `${c.firstName}, today is a clean slate`
				: `Hey ${c.firstName}, your brain is ready for a refresh`,
		recallLine: (c) =>
			`Quick recall: what was the big idea of “${c.recallTitle}”? Answer from memory, then open it to check.`,
		streakLine: (c) =>
			c.streakKind === "fresh_start"
				? `Your ${c.streakCurrent}-day streak proved you can do it. One lesson today starts a brand-new one.`
				: `Your ${c.streakCurrent}-day streak is on the line — one lesson today keeps it alive.`,
		reviewsIntro: (c) =>
			c.reviewTitles.length === 1
				? "This lesson is due for a quick revisit:"
				: `These ${c.reviewTitles.length} lessons are due for a quick revisit:`,
		cta: "Review now",
		whatsapp: (c) => {
			const tail = anchorTail(c, (p) => `Your usual slot: ${p}.`);
			if (c.streakKind === "at_risk")
				return `🔥 ${c.firstName}, your ${c.streakCurrent}-day streak is at risk! One quick lesson keeps it alive.${tail} dextalearning.com/dashboard`;
			if (c.streakKind === "fresh_start")
				return `🌱 ${c.firstName}, fresh start today — one lesson begins a new streak.${tail} dextalearning.com/dashboard`;
			const recall = c.recallTitle
				? `Quick recall: what was the big idea of “${c.recallTitle}”? Check yourself → `
				: `${c.reviewTitles.length} lesson(s) are ready for review. `;
			return `📚 ${c.firstName}, ${recall}${anchorMid(tail)}dextalearning.com/dashboard`;
		},
	},
	fr: {
		subject: (c) =>
			c.streakKind === "at_risk"
				? `Ne brisez pas votre série de ${c.streakCurrent} jours, ${c.firstName} ! 🔥`
				: c.streakKind === "fresh_start"
					? `Nouveau départ aujourd'hui, ${c.firstName} 🌱`
					: "C'est l'heure d'une petite révision 📚",
		heading: (c) =>
			c.streakKind === "fresh_start"
				? `${c.firstName}, aujourd'hui on repart à zéro`
				: `Bonjour ${c.firstName}, votre cerveau est prêt à réviser`,
		recallLine: (c) =>
			`Rappel express : quelle était l'idée clé de « ${c.recallTitle} » ? Répondez de mémoire, puis vérifiez.`,
		streakLine: (c) =>
			c.streakKind === "fresh_start"
				? `Votre série de ${c.streakCurrent} jours a prouvé que vous en êtes capable. Une leçon aujourd'hui en démarre une nouvelle.`
				: `Votre série de ${c.streakCurrent} jours est en jeu — une leçon aujourd'hui la maintient en vie.`,
		reviewsIntro: (c) =>
			c.reviewTitles.length === 1
				? "Cette leçon mérite une petite révision :"
				: `Ces ${c.reviewTitles.length} leçons méritent une petite révision :`,
		cta: "Réviser maintenant",
		whatsapp: (c) => {
			const tail = anchorTail(c, (p) => `Votre créneau habituel : ${p}.`);
			if (c.streakKind === "at_risk")
				return `🔥 ${c.firstName}, votre série de ${c.streakCurrent} jours est en danger ! Une leçon rapide la sauve.${tail} dextalearning.com/dashboard`;
			if (c.streakKind === "fresh_start")
				return `🌱 ${c.firstName}, nouveau départ — une leçon aujourd'hui lance une nouvelle série.${tail} dextalearning.com/dashboard`;
			const recall = c.recallTitle
				? `Rappel express : l'idée clé de « ${c.recallTitle} » ? Vérifiez-vous → `
				: `${c.reviewTitles.length} leçon(s) à réviser. `;
			return `📚 ${c.firstName}, ${recall}${anchorMid(tail)}dextalearning.com/dashboard`;
		},
	},
	es: {
		subject: (c) =>
			c.streakKind === "at_risk"
				? `¡No rompas tu racha de ${c.streakCurrent} días, ${c.firstName}! 🔥`
				: c.streakKind === "fresh_start"
					? `Hoy empiezas de nuevo, ${c.firstName} 🌱`
					: "Hora de un repaso rápido 📚",
		heading: (c) =>
			c.streakKind === "fresh_start"
				? `${c.firstName}, hoy es borrón y cuenta nueva`
				: `Hola ${c.firstName}, tu cerebro está listo para repasar`,
		recallLine: (c) =>
			`Recuerdo rápido: ¿cuál era la idea clave de «${c.recallTitle}»? Responde de memoria y luego compruébalo.`,
		streakLine: (c) =>
			c.streakKind === "fresh_start"
				? `Tu racha de ${c.streakCurrent} días demostró que puedes. Una lección hoy empieza una nueva.`
				: `Tu racha de ${c.streakCurrent} días está en juego — una lección hoy la mantiene viva.`,
		reviewsIntro: (c) =>
			c.reviewTitles.length === 1
				? "Esta lección está lista para un repaso rápido:"
				: `Estas ${c.reviewTitles.length} lecciones están listas para un repaso rápido:`,
		cta: "Repasar ahora",
		whatsapp: (c) => {
			const tail = anchorTail(c, (p) => `Tu momento habitual: ${p}.`);
			if (c.streakKind === "at_risk")
				return `🔥 ${c.firstName}, ¡tu racha de ${c.streakCurrent} días está en riesgo! Una lección rápida la salva.${tail} dextalearning.com/dashboard`;
			if (c.streakKind === "fresh_start")
				return `🌱 ${c.firstName}, hoy empiezas de nuevo — una lección arranca otra racha.${tail} dextalearning.com/dashboard`;
			const recall = c.recallTitle
				? `Recuerdo rápido: ¿la idea clave de «${c.recallTitle}»? Compruébate → `
				: `${c.reviewTitles.length} lección(es) para repasar. `;
			return `📚 ${c.firstName}, ${recall}${anchorMid(tail)}dextalearning.com/dashboard`;
		},
	},
	pcm: {
		subject: (c) =>
			c.streakKind === "at_risk"
				? `${c.firstName}, no break your ${c.streakCurrent}-day streak o! 🔥`
				: c.streakKind === "fresh_start"
					? `${c.firstName}, today na fresh start 🌱`
					: "Time to refresh wetin you don learn 📚",
		heading: (c) =>
			c.streakKind === "fresh_start"
				? `${c.firstName}, today na clean slate`
				: `How far ${c.firstName}, your brain don ready for refresh`,
		recallLine: (c) =>
			`Quick recall: wetin be di main idea for “${c.recallTitle}”? Answer am for your head first, then open am check.`,
		streakLine: (c) =>
			c.streakKind === "fresh_start"
				? `Your ${c.streakCurrent}-day streak don show say you fit do am. One lesson today go start new one.`
				: `Your ${c.streakCurrent}-day streak dey on the line — one lesson today go keep am alive.`,
		reviewsIntro: (c) =>
			c.reviewTitles.length === 1
				? "This lesson don due for quick revisit:"
				: `These ${c.reviewTitles.length} lessons don due for quick revisit:`,
		cta: "Review now",
		whatsapp: (c) => {
			const tail = anchorTail(c, (p) => `Your normal time na ${p}.`);
			if (c.streakKind === "at_risk")
				return `🔥 ${c.firstName}, your ${c.streakCurrent}-day streak fit break o! One quick lesson go keep am alive.${tail} dextalearning.com/dashboard`;
			if (c.streakKind === "fresh_start")
				return `🌱 ${c.firstName}, today na fresh start — one lesson go begin new streak.${tail} dextalearning.com/dashboard`;
			const recall = c.recallTitle
				? `Quick recall: wetin be di main idea for “${c.recallTitle}”? Check yourself → `
				: `${c.reviewTitles.length} lesson(s) don ready for review. `;
			return `📚 ${c.firstName}, ${recall}${anchorMid(tail)}dextalearning.com/dashboard`;
		},
	},
};
