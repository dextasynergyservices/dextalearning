import { describe, expect, it, vi } from "vitest";
import type { LessonTutorInput } from "./ai.port";
import type { ClaudeAdapter } from "./claude.adapter";
import { FallbackAdapter } from "./fallback.adapter";
import type { GeminiAdapter } from "./gemini.adapter";

const tutorInput: LessonTutorInput = {
	lessonTitle: "L",
	transcript: "t",
	question: "q",
};

function build(gemini: Partial<GeminiAdapter>, claude: Partial<ClaudeAdapter>) {
	return new FallbackAdapter(gemini as GeminiAdapter, claude as ClaudeAdapter);
}

describe("FallbackAdapter", () => {
	it("uses Gemini when it succeeds and never calls Claude", async () => {
		const claudeTutor = vi.fn();
		const adapter = build(
			{
				answerLessonQuestion: vi
					.fn()
					.mockResolvedValue({ answer: "g", grounded: true }),
			},
			{ answerLessonQuestion: claudeTutor },
		);
		const res = await adapter.answerLessonQuestion(tutorInput);
		expect(res.answer).toBe("g");
		expect(claudeTutor).not.toHaveBeenCalled();
	});

	it("falls back to Claude when Gemini throws", async () => {
		const adapter = build(
			{
				answerLessonQuestion: vi
					.fn()
					.mockRejectedValue(new Error("gemini down")),
			},
			{
				answerLessonQuestion: vi
					.fn()
					.mockResolvedValue({ answer: "c", grounded: false }),
			},
		);
		const res = await adapter.answerLessonQuestion(tutorInput);
		expect(res.answer).toBe("c");
	});

	it("propagates the error when both providers fail", async () => {
		const adapter = build(
			{ simplifyText: vi.fn().mockRejectedValue(new Error("gemini")) },
			{ simplifyText: vi.fn().mockRejectedValue(new Error("claude")) },
		);
		await expect(adapter.simplifyText({ text: "x" })).rejects.toThrow("claude");
	});

	it("streams from Gemini when it works, never touching Claude", async () => {
		async function* gemStream() {
			yield "hel";
			yield "lo";
		}
		const claudeStream = vi.fn();
		const adapter = build(
			{ answerLessonQuestionStream: gemStream },
			{ answerLessonQuestionStream: claudeStream },
		);
		let out = "";
		for await (const d of adapter.answerLessonQuestionStream(tutorInput)) {
			out += d;
		}
		expect(out).toBe("hello");
		expect(claudeStream).not.toHaveBeenCalled();
	});

	it("falls back to Claude's stream when Gemini fails before any output", async () => {
		// biome-ignore lint/correctness/useYield: intentionally throws before yielding.
		async function* gemStream(): AsyncGenerator<string> {
			throw new Error("gemini down");
		}
		async function* claudeStream() {
			yield "from-claude";
		}
		const adapter = build(
			{ answerLessonQuestionStream: gemStream },
			{ answerLessonQuestionStream: claudeStream },
		);
		let out = "";
		for await (const d of adapter.answerLessonQuestionStream(tutorInput)) {
			out += d;
		}
		expect(out).toBe("from-claude");
	});

	it("keeps embeddings on Gemini only (never Claude)", async () => {
		const claudeEmbed = vi.fn();
		const adapter = build(
			{ embed: vi.fn().mockResolvedValue([[1, 2, 3]]) },
			{ embed: claudeEmbed },
		);
		const res = await adapter.embed(["hi"]);
		expect(res).toEqual([[1, 2, 3]]);
		expect(claudeEmbed).not.toHaveBeenCalled();
	});
});
