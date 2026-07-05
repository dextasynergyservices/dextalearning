import type {
	AiPort,
	GeneratedQuestion,
	GenerateQuizInput,
	ProjectGradeDraft,
	ProjectGradeInput,
	ShortAnswerGrade,
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
}
