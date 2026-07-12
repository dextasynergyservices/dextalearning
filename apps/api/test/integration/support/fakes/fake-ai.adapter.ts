import {
	type AiPort,
	type CoachWeeklyDigest,
	type CoachWeeklyInput,
	EMBED_DIMENSIONS,
	type GeneratedQuestion,
	type GenerateQuizInput,
	type LessonTutorAnswer,
	type LessonTutorInput,
	type ProjectGradeDraft,
	type ProjectGradeInput,
	type ShortAnswerGrade,
	type SimplifyTextInput,
} from "../../../../src/shared/ai/ai.port";

/** Deterministic `AiPort` for integration tests — no real Gemini calls. */
export class FakeAiAdapter implements AiPort {
	async generateQuizQuestions(
		input: GenerateQuizInput,
	): Promise<GeneratedQuestion[]> {
		return Array.from({ length: input.count }, (_, i) => ({
			type: input.types[i % input.types.length] ?? "mcq",
			body: `Fake question ${i + 1}`,
			options: ["A", "B", "C", "D"],
			correctAnswer: "A",
			points: 1,
		}));
	}

	async gradeProjectDraft(
		input: ProjectGradeInput,
	): Promise<ProjectGradeDraft> {
		return {
			scores: input.rubric.map((r) => ({
				criterionId: r.id,
				points: r.maxPoints,
				comment: "Fake grade: full marks.",
			})),
			feedback: "Fake AI feedback.",
		};
	}

	async translate(texts: string[], _targetLanguage: string): Promise<string[]> {
		return texts;
	}

	/** Case-insensitive exact match, mirroring the deterministic fallback. */
	async gradeShortAnswers(items: ShortAnswerGrade[]): Promise<boolean[]> {
		return items.map(
			(item) =>
				item.given.trim().toLowerCase() === item.expected.trim().toLowerCase(),
		);
	}

	/** Echoes the question, marking it grounded when the transcript is non-empty. */
	async answerLessonQuestion(
		input: LessonTutorInput,
	): Promise<LessonTutorAnswer> {
		const grounded = input.transcript.trim().length > 0;
		return {
			answer: grounded
				? `Fake tutor answer about "${input.lessonTitle}": ${input.question}`
				: "I can only help with what's covered in this lesson's transcript.",
			grounded,
		};
	}

	/** Streams the fake answer in two chunks. */
	async *answerLessonQuestionStream(
		input: LessonTutorInput,
	): AsyncIterable<string> {
		yield `Fake tutor answer about "${input.lessonTitle}": `;
		yield input.question;
	}

	/** Deterministic plain-language echo of the source text. */
	async simplifyText(input: SimplifyTextInput): Promise<string> {
		return `Simplified: ${input.text.trim()}`;
	}

	/**
	 * Deterministic 768-dim embedding: identical strings map to identical
	 * vectors (cosine distance 0), so retrieval ordering is testable without a
	 * real model. Char codes bucket into dimensions, then the vector is L2-
	 * normalised so cosine distance behaves.
	 */
	async embed(texts: string[]): Promise<number[][]> {
		return texts.map((text) => {
			const v = new Array(EMBED_DIMENSIONS).fill(0);
			const clean = text.trim().toLowerCase();
			for (let i = 0; i < clean.length; i++) {
				v[clean.charCodeAt(i) % EMBED_DIMENSIONS] += 1;
			}
			const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
			return v.map((x) => x / norm);
		});
	}

	/** Deterministic coaching digest echoing the week's headline stats. */
	async coachWeekly(input: CoachWeeklyInput): Promise<CoachWeeklyDigest> {
		const s = input.stats;
		return {
			headline: `Nice work this week, ${input.firstName}!`,
			message: `You completed ${s.lessonsCompleted} lesson(s) and passed ${s.quizzesPassed} quiz(zes).`,
			action:
				"Explain one idea you learned in your own words, then start the next lesson.",
		};
	}
}
