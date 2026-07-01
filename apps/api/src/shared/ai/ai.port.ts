/**
 * AI abstraction (hexagonal port — §6.4). The domain depends on this interface;
 * the concrete Google Gemini adapter is injected via `AI_PORT`, so the provider
 * (blueprint §5: Gemini primary, Claude fallback) can be swapped without
 * touching callers.
 */
export const AI_PORT = Symbol("AI_PORT");

export type GeneratedQuestionType = "mcq" | "true_false" | "short_answer";

export interface GeneratedQuestion {
	type: GeneratedQuestionType;
	body: string;
	/** Present for MCQ. */
	options?: string[];
	/** Option text (MCQ), "true"/"false", or the expected answer (short answer). */
	correctAnswer: string;
	points?: number;
}

export interface QuizMedia {
	/** e.g. "application/pdf", "audio/mp4". */
	mimeType: string;
	data: Buffer;
}

export interface GenerateQuizInput {
	/** Preferred source — the lesson transcript / text content. */
	sourceText?: string;
	/** Fallback source when there's no usable text: the lesson media itself. */
	media?: QuizMedia;
	count: number;
	types: GeneratedQuestionType[];
	/** Optional context, e.g. the lesson title. */
	context?: string;
}

export interface RubricItem {
	id: string;
	label: string;
	maxPoints: number;
	description?: string | null;
}

export interface ProjectGradeInput {
	/** Project brief / instructions. */
	brief: string;
	rubric: RubricItem[];
	/** The learner's submission (text + URL + file names, concatenated). */
	submission: string;
}

export interface ProjectGradeDraft {
	scores: { criterionId: string; points: number; comment: string }[];
	feedback: string;
}

export interface ShortAnswerGrade {
	question: string;
	expected: string;
	given: string;
}

export interface AiPort {
	/** Generate quiz questions from source text (§4.10 — instructor-triggered). */
	generateQuizQuestions(input: GenerateQuizInput): Promise<GeneratedQuestion[]>;
	/** Draft a rubric grade for a project submission (§4.5 — instructor confirms). */
	gradeProjectDraft(input: ProjectGradeInput): Promise<ProjectGradeDraft>;
	/**
	 * Translate each string into the target language, preserving order/length
	 * (§11 — read-only display layer, never used for grading). Returns the source
	 * unchanged on failure.
	 */
	translate(texts: string[], targetLanguage: string): Promise<string[]>;
	/**
	 * Semantically judge short answers (§4.4): accepts any language + reasonable
	 * paraphrases. Returns one boolean per item (true = correct), order-preserved.
	 */
	gradeShortAnswers(items: ShortAnswerGrade[]): Promise<boolean[]>;
}
