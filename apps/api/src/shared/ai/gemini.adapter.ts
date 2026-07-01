import { GoogleGenAI, Type } from "@google/genai";
import {
	BadGatewayException,
	Injectable,
	ServiceUnavailableException,
} from "@nestjs/common";
import type {
	AiPort,
	GeneratedQuestion,
	GenerateQuizInput,
	ProjectGradeDraft,
	ProjectGradeInput,
	ShortAnswerGrade,
} from "./ai.port";

// Blueprint §5: quiz/bulk uses the budget Flash-Lite; grading uses the stronger
// Flash. Each falls back to the OTHER model on quota/transient errors — the two
// models have separate rate limits, so one hitting its cap doesn't break the
// feature, and quiz-gen stays on the cheapest model first (cost-conscious).
const FLASH = "gemini-2.5-flash";
const FLASH_LITE = "gemini-2.5-flash-lite";
const QUIZ_MODELS = [FLASH_LITE, FLASH];
const GRADE_MODELS = [FLASH, FLASH_LITE];
const VALID_TYPES = new Set(["mcq", "true_false", "short_answer"]);

const LANGUAGE_NAMES: Record<string, string> = {
	en: "English",
	fr: "French",
	es: "Spanish",
	pcm: "Nigerian Pidgin (Naijá)",
};

/** Coerce a raw model item into a clean GeneratedQuestion (or drop it). */
function normalize(raw: unknown): GeneratedQuestion | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const type = r.type;
	if (typeof type !== "string" || !VALID_TYPES.has(type)) return null;
	const body = typeof r.body === "string" ? r.body.trim() : "";
	let correctAnswer =
		typeof r.correctAnswer === "string" ? r.correctAnswer.trim() : "";
	if (!body || !correctAnswer) return null;
	const points = Number.isInteger(r.points) ? (r.points as number) : 1;

	if (type === "mcq") {
		const options = Array.isArray(r.options)
			? r.options.map((o) => String(o).trim()).filter(Boolean)
			: [];
		if (options.length < 2) return null;
		if (!options.includes(correctAnswer)) options.push(correctAnswer);
		return { type, body, options, correctAnswer, points };
	}
	if (type === "true_false") {
		correctAnswer = /^t(rue)?$/i.test(correctAnswer) ? "true" : "false";
		return { type, body, correctAnswer, points };
	}
	return { type: "short_answer", body, correctAnswer, points };
}

/** Google Gemini implementation of the AI port (@google/genai, §5). */
@Injectable()
export class GeminiAdapter implements AiPort {
	private readonly client = process.env.GEMINI_API_KEY
		? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
		: null;

	/**
	 * Calls Gemini, trying each model in order and falling back to the next when
	 * one errors (rate limit / quota / transient 5xx). Returns the first success;
	 * throws if every model fails (caller wraps it in a friendly message).
	 */
	private async generateText(
		models: string[],
		request: Omit<
			Parameters<GoogleGenAI["models"]["generateContent"]>[0],
			"model"
		>,
	): Promise<string | undefined> {
		const client = this.client;
		if (!client) {
			throw new ServiceUnavailableException({
				code: "AI_NOT_CONFIGURED",
				message: "AI is not configured (GEMINI_API_KEY missing).",
			});
		}
		const errors: string[] = [];
		for (const model of models) {
			// Retry the same model once on a transient spike (503/429/overload)
			// before falling back to the next — cheap resilience for demand spikes.
			for (let attempt = 0; attempt < 2; attempt++) {
				try {
					const response = await client.models.generateContent({
						model,
						...request,
					});
					return response.text;
				} catch (error) {
					const msg = (error as Error).message ?? "";
					const transient =
						/\b(503|429)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand/i.test(
							msg,
						);
					if (transient && attempt === 0) {
						await new Promise((r) => setTimeout(r, 1200));
						continue;
					}
					errors.push(`${model}: ${msg}`);
					break;
				}
			}
		}
		throw new Error(errors.join(" | ") || "all AI models failed");
	}

	async generateQuizQuestions(
		input: GenerateQuizInput,
	): Promise<GeneratedQuestion[]> {
		const sourceText = (input.sourceText ?? "").trim();
		const prompt = [
			"You are an expert instructional designer creating a quiz STRICTLY from the lesson material provided.",
			input.context ? `Lesson: ${input.context}` : "",
			`Generate exactly ${input.count} questions, using only these types: ${input.types.join(", ")}.`,
			"Rules:",
			"- Base every question ONLY on the provided material; never invent facts.",
			'- "mcq": provide 4 plausible options; "correctAnswer" must equal one option verbatim.',
			'- "true_false": "correctAnswer" is "true" or "false"; no options.',
			'- "short_answer": "correctAnswer" is a concise expected answer; no options.',
			"- Clear, unambiguous wording. Vary the difficulty.",
			"",
			sourceText
				? `LESSON CONTENT:\n${sourceText.slice(0, 24000)}`
				: "The lesson material is the attached file (audio or PDF). Base the questions on what it contains.",
		]
			.filter(Boolean)
			.join("\n");

		// Text is preferred; when only media is available, attach it inline so
		// Gemini reads the file directly (multimodal — §4.10 fallback).
		const contents = input.media
			? [
					{ text: prompt },
					{
						inlineData: {
							mimeType: input.media.mimeType,
							data: input.media.data.toString("base64"),
						},
					},
				]
			: prompt;

		let text: string | undefined;
		try {
			text = await this.generateText(QUIZ_MODELS, {
				contents,
				config: {
					temperature: 0.4,
					responseMimeType: "application/json",
					responseSchema: {
						type: Type.ARRAY,
						items: {
							type: Type.OBJECT,
							properties: {
								type: {
									type: Type.STRING,
									enum: ["mcq", "true_false", "short_answer"],
								},
								body: { type: Type.STRING },
								options: { type: Type.ARRAY, items: { type: Type.STRING } },
								correctAnswer: { type: Type.STRING },
								points: { type: Type.INTEGER },
							},
							required: ["type", "body", "correctAnswer"],
							propertyOrdering: [
								"type",
								"body",
								"options",
								"correctAnswer",
								"points",
							],
						},
					},
				},
			});
		} catch (error) {
			if (error instanceof ServiceUnavailableException) throw error;
			throw new BadGatewayException({
				code: "AI_GENERATION_FAILED",
				message: "The AI provider could not generate questions. Try again.",
				details: { reason: (error as Error).message },
			});
		}

		if (!text) return [];
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			return [];
		}
		if (!Array.isArray(parsed)) return [];
		return parsed
			.map(normalize)
			.filter((q): q is GeneratedQuestion => q !== null);
	}

	async gradeProjectDraft(
		input: ProjectGradeInput,
	): Promise<ProjectGradeDraft> {
		const rubricText = input.rubric
			.map(
				(r) =>
					`- [${r.id}] ${r.label} (max ${r.maxPoints} pts)${r.description ? `: ${r.description}` : ""}`,
			)
			.join("\n");
		const prompt = [
			"You are a fair, objective grading assistant. Grade the learner's submission against the rubric.",
			`PROJECT BRIEF:\n${input.brief || "(none)"}`,
			`RUBRIC:\n${rubricText || "(no rubric — judge overall quality)"}`,
			`SUBMISSION:\n${input.submission.slice(0, 24000)}`,
			"Rules:",
			"- For each rubric criterion return its id, points (0..maxPoints), and a one-sentence justification.",
			"- Base scores only on the submission; do not invent content.",
			"- Add a short constructive overall feedback paragraph.",
		].join("\n\n");

		let text: string | undefined;
		try {
			// §5: grading prefers the stronger Flash, falling back to Flash-Lite.
			text = await this.generateText(GRADE_MODELS, {
				contents: prompt,
				config: {
					temperature: 0.3,
					responseMimeType: "application/json",
					responseSchema: {
						type: Type.OBJECT,
						properties: {
							scores: {
								type: Type.ARRAY,
								items: {
									type: Type.OBJECT,
									properties: {
										criterionId: { type: Type.STRING },
										points: { type: Type.NUMBER },
										comment: { type: Type.STRING },
									},
									required: ["criterionId", "points", "comment"],
								},
							},
							feedback: { type: Type.STRING },
						},
						required: ["scores", "feedback"],
					},
				},
			});
		} catch (error) {
			if (error instanceof ServiceUnavailableException) throw error;
			throw new BadGatewayException({
				code: "AI_GRADE_FAILED",
				message: "The AI provider could not draft a grade. Try again.",
				details: { reason: (error as Error).message },
			});
		}

		if (!text) return { scores: [], feedback: "" };
		let parsed: { scores?: unknown; feedback?: unknown };
		try {
			parsed = JSON.parse(text);
		} catch {
			return { scores: [], feedback: "" };
		}
		const byId = new Map(input.rubric.map((r) => [r.id, r]));
		const scores = Array.isArray(parsed.scores)
			? parsed.scores
					.filter(
						(
							s,
						): s is {
							criterionId: string;
							points: unknown;
							comment: unknown;
						} =>
							!!s &&
							typeof s === "object" &&
							byId.has((s as { criterionId?: string }).criterionId ?? ""),
					)
					.map((s) => {
						const max = byId.get(s.criterionId)?.maxPoints ?? 0;
						return {
							criterionId: s.criterionId,
							points: Math.max(0, Math.min(max, Number(s.points) || 0)),
							comment: String(s.comment ?? ""),
						};
					})
			: [];
		return { scores, feedback: String(parsed.feedback ?? "") };
	}

	async translate(texts: string[], targetLanguage: string): Promise<string[]> {
		if (texts.length === 0) return [];
		const langName = LANGUAGE_NAMES[targetLanguage] ?? targetLanguage;
		const prompt = [
			`Translate each item of the JSON array below into ${langName}.`,
			"Return a JSON array of translations in the SAME order and length.",
			"Rules: preserve meaning, tone and formatting; keep it natural for a learner; do not add, drop or reorder items; leave numbers, code, URLs and proper nouns intact; if an item is already in the target language, return it unchanged.",
			"",
			JSON.stringify(texts),
		].join("\n");

		let text: string | undefined;
		try {
			text = await this.generateText(QUIZ_MODELS, {
				contents: prompt,
				config: {
					temperature: 0.1,
					responseMimeType: "application/json",
					responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
				},
			});
		} catch (error) {
			if (error instanceof ServiceUnavailableException) throw error;
			throw new BadGatewayException({
				code: "AI_TRANSLATE_FAILED",
				message: "Could not translate right now. Try again.",
				details: { reason: (error as Error).message },
			});
		}

		if (!text) return texts;
		try {
			const parsed = JSON.parse(text);
			if (Array.isArray(parsed) && parsed.length === texts.length) {
				return parsed.map((x) => String(x));
			}
		} catch {
			// fall through to source
		}
		return texts;
	}

	async gradeShortAnswers(items: ShortAnswerGrade[]): Promise<boolean[]> {
		if (items.length === 0) return [];
		const prompt = [
			"You are grading short-answer responses. For EACH item, decide whether the learner's answer is correct — i.e. it matches the expected answer in MEANING.",
			"Accept answers in ANY language; accept reasonable paraphrases, synonyms, and minor spelling/case differences. Reject blank, off-topic, or factually different answers.",
			"Return a JSON array of booleans in the SAME order and length — one per item.",
			"",
			JSON.stringify(
				items.map((it, i) => ({
					n: i + 1,
					question: it.question,
					expected: it.expected,
					answer: it.given,
				})),
			),
		].join("\n");

		let text: string | undefined;
		try {
			text = await this.generateText(GRADE_MODELS, {
				contents: prompt,
				config: {
					temperature: 0,
					responseMimeType: "application/json",
					responseSchema: { type: Type.ARRAY, items: { type: Type.BOOLEAN } },
				},
			});
		} catch (error) {
			if (error instanceof ServiceUnavailableException) throw error;
			throw new BadGatewayException({
				code: "AI_GRADE_FAILED",
				message: "The AI provider could not grade right now.",
				details: { reason: (error as Error).message },
			});
		}

		if (!text) return items.map(() => false);
		try {
			const parsed = JSON.parse(text);
			if (Array.isArray(parsed) && parsed.length === items.length) {
				return parsed.map((x) => x === true);
			}
		} catch {
			// fall through
		}
		return items.map(() => false);
	}
}
