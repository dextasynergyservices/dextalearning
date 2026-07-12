import {
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { SimplifierService } from "../../src/modules/simplifier/simplifier.service";
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

describe("SimplifierService (integration)", () => {
	const prisma = getTestPrisma();
	const ai = new FakeAiAdapter();
	const cache = new FakeCacheAdapter();
	const service = new SimplifierService(prisma, ai, cache);

	let learnerId: string;

	beforeEach(async () => {
		cache.reset();
		learnerId = (await createUser(prisma, { role: "learner" })).id;
	});

	async function lesson(data: {
		contentText?: string | null;
		transcriptText?: string | null;
	}) {
		const course = await createCourse(prisma);
		const mod = await createModule(prisma, course.id);
		const l = await createLesson(prisma, mod.id, { title: "Recursion" });
		await prisma.lesson.update({ where: { id: l.id }, data });
		return l.id;
	}

	it("caches the result so a repeat request skips the AI (cost saver)", async () => {
		const lessonId = await lesson({ contentText: "<p>Cache me once</p>" });
		const spy = vi.spyOn(ai, "simplifyText");
		const first = await service.simplify(asUser(learnerId), lessonId);
		const second = await service.simplify(asUser(learnerId), lessonId);
		expect(second.simplified).toBe(first.simplified);
		expect(spy).toHaveBeenCalledTimes(1); // 2nd served from cache
		spy.mockRestore();
	});

	it("simplifies the reading content, stripped of HTML", async () => {
		const lessonId = await lesson({
			contentText: "<p>Hello <b>world</b> of recursion</p>",
		});
		const res = await service.simplify(asUser(learnerId), lessonId);
		expect(res.simplified).toContain("Hello world of recursion");
		expect(res.simplified).not.toContain("<p>");
		expect(res.simplified).not.toContain("<b>");
	});

	it("falls back to the transcript when there is no reading content", async () => {
		const lessonId = await lesson({
			contentText: null,
			transcriptText: "A function that calls itself.",
		});
		const res = await service.simplify(asUser(learnerId), lessonId);
		expect(res.simplified).toContain("A function that calls itself.");
	});

	it("prefers the reading content over the transcript", async () => {
		const lessonId = await lesson({
			contentText: "<p>Read me</p>",
			transcriptText: "Hear me",
		});
		const res = await service.simplify(asUser(learnerId), lessonId);
		expect(res.simplified).toContain("Read me");
		expect(res.simplified).not.toContain("Hear me");
	});

	it("404s for an unknown lesson", async () => {
		await expect(
			service.simplify(
				asUser(learnerId),
				"00000000-0000-0000-0000-000000000000",
			),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("422s when the lesson has no text to simplify", async () => {
		const lessonId = await lesson({ contentText: null, transcriptText: null });
		await expect(
			service.simplify(asUser(learnerId), lessonId),
		).rejects.toBeInstanceOf(UnprocessableEntityException);
	});

	it("treats HTML-only markup as no content", async () => {
		const lessonId = await lesson({
			contentText: "<p></p>",
			transcriptText: "",
		});
		await expect(
			service.simplify(asUser(learnerId), lessonId),
		).rejects.toBeInstanceOf(UnprocessableEntityException);
	});
});
