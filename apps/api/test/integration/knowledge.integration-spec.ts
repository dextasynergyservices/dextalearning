import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { EmbeddingStore } from "../../src/modules/knowledge/embedding.store";
import { KnowledgeEventsHandler } from "../../src/modules/knowledge/knowledge.events-handler";
import { KnowledgeService } from "../../src/modules/knowledge/knowledge.service";
import { getTestPrisma } from "./support/db";
import {
	createCohort,
	createCohortCourse,
	createCohortPath,
	createCourse,
	createPath,
	createPathCourse,
} from "./support/factories";
import { FakeAiAdapter } from "./support/fakes/fake-ai.adapter";
import { FakeCacheAdapter } from "./support/fakes/fake-cache.adapter";

const A = "Arrays store elements in one contiguous block of memory.";
const B = "Recursion is a function that calls itself to solve a problem.";

describe("Knowledge / RAG (integration)", () => {
	const prisma = getTestPrisma();
	const ai = new FakeAiAdapter();
	const store = new EmbeddingStore(prisma);
	const service = new KnowledgeService(
		ai,
		store,
		new FakeCacheAdapter(),
		prisma,
	);
	const handler = new KnowledgeEventsHandler(service);

	beforeAll(async () => {
		await store.ensureSchema();
	});

	// resetDatabase (global setup) truncates content_embeddings between tests.
	beforeEach(async () => {
		await service.indexLesson({
			lessonId: "lessonA",
			lessonTitle: "Arrays",
			courseId: "courseX",
			transcriptText: A,
		});
		await service.indexLesson({
			lessonId: "lessonB",
			lessonTitle: "Recursion",
			courseId: "courseX",
			transcriptText: B,
		});
	});

	it("ranks the semantically-closest lesson first", async () => {
		const hits = await service.search(B, { courseIds: ["courseX"] });
		expect(hits[0].lessonId).toBe("lessonB");
		expect(hits[0].distance).toBeLessThan(0.0001); // identical text → distance 0
	});

	it("collapses course search to the best passage per lesson", async () => {
		const results = await service.searchCourse("courseX", A);
		expect(results[0].lessonId).toBe("lessonA");
		expect(results[0].lessonTitle).toBe("Arrays");
		expect(results.map((r) => r.lessonId)).not.toContain(undefined);
		// One row per lesson (2 indexed lessons).
		expect(new Set(results.map((r) => r.lessonId)).size).toBe(results.length);
	});

	it("scopes results to the requested course", async () => {
		await service.indexLesson({
			lessonId: "lessonC",
			lessonTitle: "Other",
			courseId: "otherCourse",
			transcriptText: "Completely unrelated content about baking bread.",
		});
		const results = await service.searchCourse("courseX", A);
		expect(results.map((r) => r.lessonId)).not.toContain("lessonC");
	});

	it("re-indexing a lesson replaces its old chunks", async () => {
		await service.indexLesson({
			lessonId: "lessonA",
			lessonTitle: "Arrays",
			courseId: "courseX",
			transcriptText: "Now about linked lists and pointers only.",
		});
		const hits = await service.search(A, { lessonId: "lessonA" });
		// Old text no longer present verbatim.
		expect(hits.every((h) => h.content !== A)).toBe(true);
	});

	it("clears chunks when a transcript becomes empty", async () => {
		const res = await service.indexLesson({
			lessonId: "lessonA",
			lessonTitle: "Arrays",
			courseId: "courseX",
			transcriptText: "   ",
		});
		expect(res.chunks).toBe(0);
		const hits = await service.search(A, { lessonId: "lessonA" });
		expect(hits).toHaveLength(0);
	});

	it("indexes via the TranscriptUpdated handler", async () => {
		await handler.onTranscriptUpdated({
			lessonId: "lessonD",
			lessonTitle: "Hashing",
			courseId: "courseX",
			transcriptText: "A hash map maps keys to values in constant time.",
		});
		const results = await service.searchCourse(
			"courseX",
			"A hash map maps keys to values in constant time.",
		);
		expect(results[0].lessonId).toBe("lessonD");
	});

	it("returns nothing for a blank query", async () => {
		expect(await service.search("   ", { courseIds: ["courseX"] })).toEqual([]);
	});

	it("searchPath spans all the path's member courses", async () => {
		const c1 = await createCourse(prisma);
		const c2 = await createCourse(prisma);
		await service.indexLesson({
			lessonId: "lp1",
			lessonTitle: "In C1",
			courseId: c1.id,
			transcriptText: "Binary search halves the range each step.",
		});
		await service.indexLesson({
			lessonId: "lp2",
			lessonTitle: "In C2",
			courseId: c2.id,
			transcriptText: "Quicksort partitions around a pivot.",
		});
		const path = await createPath(prisma);
		await createPathCourse(prisma, { pathId: path.id, courseId: c1.id });
		await createPathCourse(prisma, { pathId: path.id, courseId: c2.id });

		const results = await service.searchPath(
			path.id,
			"Quicksort partitions around a pivot.",
		);
		expect(results[0].lessonId).toBe("lp2");
		// A course NOT in the path is excluded.
		const none = await service.searchPath(path.id, A);
		expect(none.map((r) => r.lessonId)).not.toContain("lessonA");
	});

	it("searchCohort spans direct courses AND its paths' courses", async () => {
		const direct = await createCourse(prisma);
		const viaPath = await createCourse(prisma);
		await service.indexLesson({
			lessonId: "lc1",
			lessonTitle: "Direct",
			courseId: direct.id,
			transcriptText: "A stack is last-in first-out.",
		});
		await service.indexLesson({
			lessonId: "lc2",
			lessonTitle: "Via path",
			courseId: viaPath.id,
			transcriptText: "A queue is first-in first-out.",
		});
		const cohort = await createCohort(prisma);
		const path = await createPath(prisma);
		await createPathCourse(prisma, { pathId: path.id, courseId: viaPath.id });
		await createCohortCourse(prisma, {
			cohortId: cohort.id,
			courseId: direct.id,
		});
		await createCohortPath(prisma, { cohortId: cohort.id, pathId: path.id });

		const directHit = await service.searchCohort(
			cohort.id,
			"A stack is last-in first-out.",
		);
		expect(directHit[0].lessonId).toBe("lc1");
		const pathHit = await service.searchCohort(
			cohort.id,
			"A queue is first-in first-out.",
		);
		expect(pathHit[0].lessonId).toBe("lc2");
	});
});
