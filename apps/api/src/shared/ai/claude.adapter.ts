import Anthropic from "@anthropic-ai/sdk";
import {
	BadGatewayException,
	Injectable,
	Logger,
	ServiceUnavailableException,
} from "@nestjs/common";
import type {
	AiPort,
	CoachWeeklyDigest,
	CoachWeeklyInput,
	EmbedTaskType,
	GeneratedQuestion,
	GenerateQuizInput,
	LessonTutorAnswer,
	LessonTutorInput,
	ProjectGradeDraft,
	ProjectGradeInput,
	ShortAnswerGrade,
	SimplifyTextInput,
} from "./ai.port";

// Blueprint §5 names Claude Sonnet as the fallback provider. The exact model id
// is env-overridable so it can track Anthropic's releases without a code change.
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
const MAX_TOKENS = 2048;

const LANGUAGE_NAMES: Record<string, string> = {
	en: "English",
	fr: "French",
	es: "Spanish",
	pcm: "Nigerian Pidgin (Naijá)",
};

/** Extract the first JSON value from a model reply (tolerates code fences). */
function parseJson<T>(text: string): T | null {
	const cleaned = text.replace(/```json|```/g, "").trim();
	const start = cleaned.search(/[[{]/);
	if (start === -1) return null;
	try {
		return JSON.parse(cleaned.slice(start)) as T;
	} catch {
		return null;
	}
}

/**
 * Anthropic (Claude Sonnet) implementation of the AI port — the §5 fallback used
 * by `FallbackAdapter` when Gemini is unavailable. Prompts mirror the Gemini
 * adapter's intent, asking for the same JSON shapes. Embeddings are NOT a Claude
 * capability, so `embed` throws — the fallback keeps embeddings on Gemini.
 */
@Injectable()
export class ClaudeAdapter implements AiPort {
	private readonly logger = new Logger(ClaudeAdapter.name);
	private readonly client = process.env.ANTHROPIC_API_KEY
		? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
		: null;

	private async complete(system: string, user: string): Promise<string> {
		if (!this.client) {
			throw new ServiceUnavailableException({
				code: "AI_NOT_CONFIGURED",
				message:
					"Claude fallback is not configured (ANTHROPIC_API_KEY missing).",
			});
		}
		const startedAt = Date.now();
		try {
			const res = await this.client.messages.create({
				model: CLAUDE_MODEL,
				max_tokens: MAX_TOKENS,
				system,
				messages: [{ role: "user", content: user }],
			});
			const text = res.content
				.map((b) => (b.type === "text" ? b.text : ""))
				.join("");
			this.logger.log(
				`ai.generate model=${CLAUDE_MODEL} in=${res.usage.input_tokens} out=${res.usage.output_tokens} ms=${Date.now() - startedAt}`,
			);
			return text;
		} catch (error) {
			throw new BadGatewayException({
				code: "AI_CLAUDE_FAILED",
				message: "The fallback AI provider could not respond.",
				details: { reason: (error as Error).message },
			});
		}
	}

	async answerLessonQuestion(
		input: LessonTutorInput,
	): Promise<LessonTutorAnswer> {
		const lang = input.language
			? (LANGUAGE_NAMES[input.language] ?? input.language)
			: "the learner's language";
		const text = await this.complete(
			`You are a warm tutor. Answer ONLY from the lesson text; if it doesn't cover the question, set grounded=false. Reply in ${lang}, 2–5 short sentences. Return ONLY JSON: {"answer": string, "grounded": boolean}.`,
			`LESSON: ${input.lessonTitle}\n\nLESSON TEXT:\n${input.transcript.slice(0, 24000)}\n\nQUESTION: ${input.question}`,
		);
		const parsed = parseJson<{ answer?: unknown; grounded?: unknown }>(text);
		return {
			answer: String(parsed?.answer ?? text).trim(),
			grounded: parsed?.grounded === true,
		};
	}

	async simplifyText(input: SimplifyTextInput): Promise<string> {
		const lang = input.language
			? (LANGUAGE_NAMES[input.language] ?? input.language)
			: "the same language";
		const text = await this.complete(
			`Rewrite the lesson text in plain, simple ${lang}, preserving every fact. Short sentences, common words. Return ONLY the rewritten text.`,
			`${input.lessonTitle ? `TITLE: ${input.lessonTitle}\n\n` : ""}${input.text.slice(0, 24000)}`,
		);
		return text.trim();
	}

	async coachWeekly(input: CoachWeeklyInput): Promise<CoachWeeklyDigest> {
		const lang = LANGUAGE_NAMES[input.language] ?? input.language;
		const s = input.stats;
		const text = await this.complete(
			`You are an encouraging learning coach. Growth-mindset framing, never shaming. Write in ${lang}. Return ONLY JSON: {"headline": string, "message": string, "action": string} where action has one concrete next step plus a self-explanation prompt.`,
			`This week — lessons:${s.lessonsCompleted} quizzesPassed:${s.quizzesPassed} quizzesFailed:${s.quizzesFailed} avgScore:${s.avgQuizScore ?? "n/a"} coursesDone:${s.coursesCompleted} badges:${s.badgesEarned} streak:${s.currentStreak}. Learner: ${input.firstName}.`,
		);
		const p = parseJson<Partial<CoachWeeklyDigest>>(text);
		return {
			headline: String(p?.headline ?? "").trim(),
			message: String(p?.message ?? "").trim(),
			action: String(p?.action ?? "").trim(),
		};
	}

	async gradeProjectDraft(
		input: ProjectGradeInput,
	): Promise<ProjectGradeDraft> {
		const rubric = input.rubric
			.map((r) => `[${r.id}] ${r.label} (max ${r.maxPoints})`)
			.join("\n");
		const text = await this.complete(
			`Grade the submission against the rubric. Return ONLY JSON: {"scores":[{"criterionId":string,"points":number,"comment":string}],"feedback":string}.`,
			`BRIEF:\n${input.brief}\n\nRUBRIC:\n${rubric}\n\nSUBMISSION:\n${input.submission.slice(0, 24000)}`,
		);
		const parsed = parseJson<ProjectGradeDraft>(text);
		if (!parsed?.scores) return { scores: [], feedback: "" };
		const byId = new Map(input.rubric.map((r) => [r.id, r.maxPoints]));
		return {
			scores: parsed.scores
				.filter((sc) => byId.has(sc.criterionId))
				.map((sc) => ({
					criterionId: sc.criterionId,
					points: Math.max(
						0,
						Math.min(byId.get(sc.criterionId) ?? 0, Number(sc.points) || 0),
					),
					comment: String(sc.comment ?? ""),
				})),
			feedback: String(parsed.feedback ?? ""),
		};
	}

	async generateQuizQuestions(
		input: GenerateQuizInput,
	): Promise<GeneratedQuestion[]> {
		const source = (input.sourceText ?? "").slice(0, 24000);
		if (!source) return []; // fallback can't read media; Gemini handles that
		const text = await this.complete(
			`Create exactly ${input.count} quiz questions (types: ${input.types.join(", ")}) STRICTLY from the material. Return ONLY a JSON array of {"type","body","options"?,"correctAnswer","points"}.`,
			source,
		);
		const parsed = parseJson<GeneratedQuestion[]>(text);
		return Array.isArray(parsed) ? parsed.filter((q) => q?.body) : [];
	}

	async gradeShortAnswers(items: ShortAnswerGrade[]): Promise<boolean[]> {
		if (items.length === 0) return [];
		const text = await this.complete(
			`For each item decide if the answer matches the expected answer in meaning. Accept paraphrases/any language. Return ONLY a JSON array of booleans, same order/length.`,
			JSON.stringify(
				items.map((i) => ({
					q: i.question,
					expected: i.expected,
					answer: i.given,
				})),
			),
		);
		const parsed = parseJson<unknown[]>(text);
		return Array.isArray(parsed) && parsed.length === items.length
			? parsed.map((x) => x === true)
			: items.map(() => false);
	}

	async translate(texts: string[], targetLanguage: string): Promise<string[]> {
		if (texts.length === 0) return [];
		const lang = LANGUAGE_NAMES[targetLanguage] ?? targetLanguage;
		const text = await this.complete(
			`Translate each array item into ${lang}. Return ONLY a JSON array of strings, same order/length. Keep numbers/code/URLs intact.`,
			JSON.stringify(texts),
		);
		const parsed = parseJson<unknown[]>(text);
		return Array.isArray(parsed) && parsed.length === texts.length
			? parsed.map((x) => String(x))
			: texts;
	}

	async *answerLessonQuestionStream(
		input: LessonTutorInput,
	): AsyncIterable<string> {
		if (!this.client) {
			throw new ServiceUnavailableException({
				code: "AI_NOT_CONFIGURED",
				message:
					"Claude fallback is not configured (ANTHROPIC_API_KEY missing).",
			});
		}
		const lang = input.language
			? (LANGUAGE_NAMES[input.language] ?? input.language)
			: "the learner's language";
		const stream = await this.client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: MAX_TOKENS,
			stream: true,
			system: `You are a warm tutor. Answer ONLY from the lesson text; if it doesn't cover the question, gently say so. Reply in ${lang}, 2–5 short sentences.`,
			messages: [
				{
					role: "user",
					content: `LESSON: ${input.lessonTitle}\n\nLESSON TEXT:\n${input.transcript.slice(0, 24000)}\n\nQUESTION: ${input.question}`,
				},
			],
		});
		for await (const event of stream) {
			if (
				event.type === "content_block_delta" &&
				event.delta.type === "text_delta"
			) {
				yield event.delta.text;
			}
		}
	}

	embed(_texts: string[], _taskType?: EmbedTaskType): Promise<number[][]> {
		// Claude has no embeddings API — the fallback keeps embeddings on Gemini.
		return Promise.reject(
			new ServiceUnavailableException({
				code: "AI_EMBED_UNSUPPORTED",
				message: "Embeddings are not available on the fallback provider.",
			}),
		);
	}
}
