import {
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { EmbeddingStore } from "../../src/modules/knowledge/embedding.store";
import { KnowledgeService } from "../../src/modules/knowledge/knowledge.service";
import { KnowledgeQueryService } from "../../src/modules/knowledge/knowledge-query.service";
import { TutorService } from "../../src/modules/tutor/tutor.service";
import { getTestPrisma } from "./support/db";
import {
	createCourse,
	createLesson,
	createModule,
	createUser,
} from "./support/factories";
import { FakeAiAdapter } from "./support/fakes/fake-ai.adapter";
import { FakeCacheAdapter } from "./support/fakes/fake-cache.adapter";

function asUser(id: string): AuthenticatedUser {
	return { id, email: `${id}@example.com`, role: "learner" };
}

describe("TutorService (integration)", () => {
	const prisma = getTestPrisma();
	const ai = new FakeAiAdapter();
	const cache = new FakeCacheAdapter();
	const store = new EmbeddingStore(prisma);
	const knowledge = new KnowledgeQueryService(
		new KnowledgeService(ai, store, cache, prisma),
	);
	const service = new TutorService(prisma, ai, knowledge, cache);

	let learnerId: string;

	// The tutor's RAG lookup queries content_embeddings; ensure it exists so the
	// retrieval path runs (returns nothing for un-indexed lessons → transcript).
	beforeAll(async () => {
		await store.ensureSchema();
	});

	beforeEach(async () => {
		learnerId = (await createUser(prisma, { role: "learner" })).id;
	});

	async function lessonWithTranscript(transcript: string | null) {
		const course = await createCourse(prisma);
		const mod = await createModule(prisma, course.id);
		const lesson = await createLesson(prisma, mod.id, {
			title: "Big-O basics",
		});
		if (transcript !== null) {
			await prisma.lesson.update({
				where: { id: lesson.id },
				data: { transcriptText: transcript },
			});
		}
		return lesson.id;
	}

	it("answers a question grounded in the lesson transcript", async () => {
		const lessonId = await lessonWithTranscript(
			"Big-O describes how runtime grows with input size.",
		);

		const res = await service.ask(asUser(learnerId), lessonId, {
			question: "What is Big-O?",
		});

		expect(res.grounded).toBe(true);
		expect(res.answer).toContain("Big-O basics");
		expect(res.answer).toContain("What is Big-O?");
	});

	it("passes prior turns through as history", async () => {
		const lessonId = await lessonWithTranscript(
			"Arrays are contiguous memory.",
		);
		const res = await service.ask(asUser(learnerId), lessonId, {
			question: "And linked lists?",
			history: [
				{ role: "user", content: "What is an array?" },
				{ role: "assistant", content: "A contiguous block of memory." },
			],
		});
		expect(res.grounded).toBe(true);
	});

	it("404s for an unknown lesson", async () => {
		await expect(
			service.ask(asUser(learnerId), "00000000-0000-0000-0000-000000000000", {
				question: "Anything?",
			}),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("422s when the lesson has no transcript to tutor from", async () => {
		const lessonId = await lessonWithTranscript(null);
		await expect(
			service.ask(asUser(learnerId), lessonId, { question: "Help?" }),
		).rejects.toBeInstanceOf(UnprocessableEntityException);
	});

	it("treats a whitespace-only transcript as no transcript", async () => {
		const lessonId = await lessonWithTranscript("   \n  ");
		await expect(
			service.ask(asUser(learnerId), lessonId, { question: "Help?" }),
		).rejects.toBeInstanceOf(UnprocessableEntityException);
	});
});
