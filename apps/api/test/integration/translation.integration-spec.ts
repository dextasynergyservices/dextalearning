import { describe, expect, it, vi } from "vitest";
import { TranslationService } from "../../src/modules/translation/translation.service";
import { getTestPrisma } from "./support/db";
import { FakeAiAdapter } from "./support/fakes/fake-ai.adapter";

describe("TranslationService (integration)", () => {
	const prisma = getTestPrisma();

	it("returns [] immediately for an empty input, without touching the AI", async () => {
		const ai = new FakeAiAdapter();
		const spy = vi.spyOn(ai, "translate");
		const service = new TranslationService(prisma, ai);
		const result = await service.translate([], "fr");
		expect(result).toEqual([]);
		expect(spy).not.toHaveBeenCalled();
	});

	it("translates and caches uncached text", async () => {
		const ai = new FakeAiAdapter();
		vi.spyOn(ai, "translate").mockResolvedValue(["Bonjour"]);
		const service = new TranslationService(prisma, ai);
		const result = await service.translate(["Hello"], "fr");
		expect(result).toEqual(["Bonjour"]);
		const cached = await prisma.translationCache.findMany({
			where: { language: "fr" },
		});
		expect(cached).toHaveLength(1);
		expect(cached[0].text).toBe("Bonjour");
	});

	it("serves subsequent requests from the cache without calling the AI again", async () => {
		const ai = new FakeAiAdapter();
		const spy = vi.spyOn(ai, "translate").mockResolvedValue(["Bonjour"]);
		const service = new TranslationService(prisma, ai);
		await service.translate(["Hello"], "fr");
		expect(spy).toHaveBeenCalledTimes(1);

		const second = await service.translate(["Hello"], "fr");
		expect(second).toEqual(["Bonjour"]);
		expect(spy).toHaveBeenCalledTimes(1); // not called again
	});

	it("translates a repeated source text only once (hash dedup)", async () => {
		const ai = new FakeAiAdapter();
		const spy = vi.spyOn(ai, "translate").mockResolvedValue(["Bonjour"]);
		const service = new TranslationService(prisma, ai);
		const result = await service.translate(["Hello", "Hello"], "fr");
		expect(result).toEqual(["Bonjour", "Bonjour"]);
		expect(spy).toHaveBeenCalledWith(["Hello"], "fr");
		const cached = await prisma.translationCache.findMany({
			where: { language: "fr" },
		});
		expect(cached).toHaveLength(1);
	});

	it("caches the same source text separately per language", async () => {
		const ai = new FakeAiAdapter();
		vi.spyOn(ai, "translate").mockImplementation(async (texts, lang) =>
			texts.map((t) => `${t}-${lang}`),
		);
		const service = new TranslationService(prisma, ai);
		await service.translate(["Hello"], "fr");
		await service.translate(["Hello"], "es");
		const cached = await prisma.translationCache.findMany({});
		expect(cached).toHaveLength(2);
		expect(cached.map((c) => c.language).sort()).toEqual(["es", "fr"]);
	});
});
