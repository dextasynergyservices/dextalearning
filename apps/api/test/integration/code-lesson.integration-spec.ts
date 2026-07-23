import { EventEmitter2 } from "@nestjs/event-emitter";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { CompletionService } from "../../src/modules/completion/completion.service";
import { MediaService } from "../../src/modules/media/media.service";
import { getTestPrisma } from "./support/db";
import { createCourse, createModule, createUser } from "./support/factories";
import { FakeMediaEncoderAdapter } from "./support/fakes/fake-media-encoder.adapter";
import { FakeQueuePort } from "./support/fakes/fake-queue";
import { FakeStorageAdapter } from "./support/fakes/fake-storage.adapter";

const asUser = (id: string): AuthenticatedUser => ({
	id,
	email: `${id}@example.com`,
	role: "learner",
});

/**
 * Monaco code lessons (Phase 9 · D4). The learner-facing bundle exposes only the
 * config (never a solution), and completion rides the same boolean signal as
 * text/pdf — sent when the learner finishes the exercise.
 */
describe("Code lessons (integration)", () => {
	const prisma = getTestPrisma();
	const events = new EventEmitter2();
	const media = new MediaService(
		prisma,
		events,
		new FakeStorageAdapter(),
		new FakeMediaEncoderAdapter(0),
		new FakeQueuePort(),
	);
	const completion = new CompletionService(
		prisma,
		new FakeStorageAdapter(),
		events,
	);

	let learnerId: string;
	beforeEach(async () => {
		learnerId = (await createUser(prisma, { role: "learner" })).id;
	});

	async function makeCodeLesson() {
		const course = await createCourse(prisma);
		const mod = await createModule(prisma, course.id);
		const lesson = await prisma.lesson.create({
			data: {
				moduleId: mod.id,
				title: "Reverse a string",
				orderIndex: 1,
				contentType: "code",
				codeConfigJson: {
					language: "javascript",
					instructions: "Return the reversed string.",
					starterCode: "function reverse(s) {\n  // your code\n}",
				},
			},
		});
		return lesson.id;
	}

	it("media token serves the code config (language, instructions, starter)", async () => {
		const lessonId = await makeCodeLesson();
		const token = await media.getMediaToken(lessonId, asUser(learnerId));
		expect(token.type).toBe("code");
		if (token.type !== "code") throw new Error("expected code token");
		expect(token.code).toEqual({
			language: "javascript",
			instructions: "Return the reversed string.",
			starterCode: "function reverse(s) {\n  // your code\n}",
		});
	});

	it("does not complete without the finish signal", async () => {
		const lessonId = await makeCodeLesson();
		const res = await completion.recordLessonProgress(
			asUser(learnerId),
			lessonId,
			{},
		);
		expect(res.done).toBe(false);
	});

	it("completes when the learner marks the exercise done (scrolledToEnd)", async () => {
		const lessonId = await makeCodeLesson();
		const res = await completion.recordLessonProgress(
			asUser(learnerId),
			lessonId,
			{ scrolledToEnd: true },
		);
		expect(res.done).toBe(true);
		expect(res.course.summary.isComplete).toBe(true);
	});
});
