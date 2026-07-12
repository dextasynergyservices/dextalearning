import { Injectable, Logger } from "@nestjs/common";
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
import { ClaudeAdapter } from "./claude.adapter";
import { GeminiAdapter } from "./gemini.adapter";

/**
 * Resilient composite bound to `AI_PORT` (§5): every generation tries Gemini
 * first and falls back to Claude Sonnet if Gemini throws (outage/quota). Callers
 * are unchanged (§6.4). Embeddings stay Gemini-only — Claude has no embeddings
 * API and `text-embedding-004`'s 768-dim vectors are the store's contract.
 */
@Injectable()
export class FallbackAdapter implements AiPort {
	private readonly logger = new Logger(FallbackAdapter.name);

	constructor(
		private readonly gemini: GeminiAdapter,
		private readonly claude: ClaudeAdapter,
	) {}

	private async withFallback<T>(
		op: string,
		primary: () => Promise<T>,
		fallback: () => Promise<T>,
	): Promise<T> {
		try {
			return await primary();
		} catch (error) {
			this.logger.warn(
				`gemini ${op} failed — falling back to claude: ${(error as Error).message}`,
			);
			return fallback();
		}
	}

	answerLessonQuestion(input: LessonTutorInput): Promise<LessonTutorAnswer> {
		return this.withFallback(
			"tutor",
			() => this.gemini.answerLessonQuestion(input),
			() => this.claude.answerLessonQuestion(input),
		);
	}

	simplifyText(input: SimplifyTextInput): Promise<string> {
		return this.withFallback(
			"simplify",
			() => this.gemini.simplifyText(input),
			() => this.claude.simplifyText(input),
		);
	}

	coachWeekly(input: CoachWeeklyInput): Promise<CoachWeeklyDigest> {
		return this.withFallback(
			"coach",
			() => this.gemini.coachWeekly(input),
			() => this.claude.coachWeekly(input),
		);
	}

	gradeProjectDraft(input: ProjectGradeInput): Promise<ProjectGradeDraft> {
		return this.withFallback(
			"grade",
			() => this.gemini.gradeProjectDraft(input),
			() => this.claude.gradeProjectDraft(input),
		);
	}

	generateQuizQuestions(
		input: GenerateQuizInput,
	): Promise<GeneratedQuestion[]> {
		return this.withFallback(
			"quiz",
			() => this.gemini.generateQuizQuestions(input),
			() => this.claude.generateQuizQuestions(input),
		);
	}

	gradeShortAnswers(items: ShortAnswerGrade[]): Promise<boolean[]> {
		return this.withFallback(
			"short-answer",
			() => this.gemini.gradeShortAnswers(items),
			() => this.claude.gradeShortAnswers(items),
		);
	}

	translate(texts: string[], targetLanguage: string): Promise<string[]> {
		return this.withFallback(
			"translate",
			() => this.gemini.translate(texts, targetLanguage),
			() => this.claude.translate(texts, targetLanguage),
		);
	}

	async *answerLessonQuestionStream(
		input: LessonTutorInput,
	): AsyncIterable<string> {
		let yielded = false;
		try {
			for await (const delta of this.gemini.answerLessonQuestionStream(input)) {
				yielded = true;
				yield delta;
			}
			return;
		} catch (error) {
			// Only fall back if Gemini failed BEFORE emitting anything — a stream
			// can't be cleanly resumed mid-answer.
			if (yielded) throw error;
			this.logger.warn(
				`gemini tutor-stream failed early — falling back to claude: ${(error as Error).message}`,
			);
		}
		yield* this.claude.answerLessonQuestionStream(input);
	}

	/** Embeddings are Gemini-only — no Claude equivalent. */
	embed(texts: string[], taskType?: EmbedTaskType): Promise<number[][]> {
		return this.gemini.embed(texts, taskType);
	}
}
