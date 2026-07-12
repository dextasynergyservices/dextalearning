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

export interface TutorMessage {
	role: "user" | "assistant";
	content: string;
}

export interface LessonTutorInput {
	lessonTitle: string;
	/** Instructor-uploaded transcript — the sole knowledge source (§4.10). */
	transcript: string;
	question: string;
	/** Prior turns for follow-up context (oldest first). */
	history?: TutorMessage[];
	/** Learner's language for the reply (en/fr/es/pcm). */
	language?: string;
}

export interface LessonTutorAnswer {
	answer: string;
	/** false when the transcript doesn't cover the question — UI can flag it. */
	grounded: boolean;
}

export interface SimplifyTextInput {
	/** The lesson prose to simplify (HTML already stripped to plain text). */
	text: string;
	lessonTitle?: string;
	/** Language to write the simplified version in (en/fr/es/pcm). */
	language?: string;
}

export interface CoachWeeklyStats {
	lessonsCompleted: number;
	quizzesPassed: number;
	quizzesFailed: number;
	/** Mean quiz score this week (0–100), or null when no quizzes taken. */
	avgQuizScore: number | null;
	coursesCompleted: number;
	badgesEarned: number;
	currentStreak: number;
	/** Streak alive but idle — a gentle nudge is warranted (§3.2). */
	streakAtRisk: boolean;
}

export interface CoachWeeklyInput {
	firstName: string;
	/** Language to write the coaching in (en/fr/es/pcm). */
	language: string;
	stats: CoachWeeklyStats;
}

export interface CoachWeeklyDigest {
	/** Short, warm, growth-framed headline (§3.1). */
	headline: string;
	/** 2–4 sentence encouraging analysis of the week. */
	message: string;
	/** One concrete next step + a self-explanation prompt (§3.1, blueprint L176). */
	action: string;
}

/**
 * Retrieval task the embedding is for — `document` when indexing stored content,
 * `query` when embedding a search query. Providers use this to optimise the
 * vector for asymmetric retrieval (§4.10 RAG).
 */
export type EmbedTaskType = "document" | "query";

/** Fixed embedding dimensionality (text-embedding-004 → 768). */
export const EMBED_DIMENSIONS = 768;

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
	/**
	 * Answer a learner's question about a lesson, grounded ONLY in the
	 * instructor's transcript (§4.10 — the transcript is the sole knowledge
	 * source). Sets `grounded=false` when the transcript doesn't cover it.
	 */
	answerLessonQuestion(input: LessonTutorInput): Promise<LessonTutorAnswer>;
	/**
	 * Streaming variant of {@link answerLessonQuestion} — yields answer text
	 * deltas as they're generated, for a live typing effect (§4.10). Plain text,
	 * grounded strictly in the transcript (the prompt tells it to say so when a
	 * question isn't covered).
	 */
	answerLessonQuestionStream(input: LessonTutorInput): AsyncIterable<string>;
	/**
	 * Rewrite lesson prose in plain, beginner-friendly language while preserving
	 * every fact (§4.10 — "Simplify this"). Returns the simplified text.
	 */
	simplifyText(input: SimplifyTextInput): Promise<string>;
	/**
	 * Embed each text into a vector for semantic search (§4.10 RAG). Returns one
	 * `EMBED_DIMENSIONS`-length vector per input, order-preserved.
	 */
	embed(texts: string[], taskType?: EmbedTaskType): Promise<number[][]>;
	/**
	 * Compose a weekly, growth-framed coaching digest from a learner's activity
	 * (§4.10 Learning Coach; §3.1 growth mindset + self-explanation).
	 */
	coachWeekly(input: CoachWeeklyInput): Promise<CoachWeeklyDigest>;
}
