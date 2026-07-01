import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { LanguageCode } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AI_PORT, type AiPort } from "../../shared/ai/ai.port";

/**
 * Read-only translation with a durable cache (§11). Each unique source text is
 * AI-translated once per language and reused forever — this layer is for display
 * only and never touches grading (which always uses the canonical content).
 */
@Injectable()
export class TranslationService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(AI_PORT) private readonly ai: AiPort,
	) {}

	async translate(texts: string[], language: LanguageCode): Promise<string[]> {
		if (texts.length === 0) return [];
		const hash = (t: string) =>
			createHash("sha256")
				.update(t ?? "")
				.digest("hex");
		const hashes = texts.map(hash);
		const uniqueHashes = [...new Set(hashes)];

		const cached = await this.prisma.translationCache.findMany({
			where: { language, sourceHash: { in: uniqueHashes } },
			select: { sourceHash: true, text: true },
		});
		const map = new Map(cached.map((c) => [c.sourceHash, c.text]));

		const missingHashes = uniqueHashes.filter((h) => !map.has(h));
		if (missingHashes.length > 0) {
			const firstTextByHash = new Map<string, string>();
			hashes.forEach((h, i) => {
				if (!firstTextByHash.has(h)) firstTextByHash.set(h, texts[i]);
			});
			const missingTexts = missingHashes.map(
				(h) => firstTextByHash.get(h) ?? "",
			);
			const translated = await this.ai.translate(missingTexts, language);
			const rows = missingHashes.map((h, i) => ({
				sourceHash: h,
				language,
				text: translated[i] ?? missingTexts[i],
			}));
			await this.prisma.translationCache.createMany({
				data: rows,
				skipDuplicates: true,
			});
			for (const r of rows) map.set(r.sourceHash, r.text);
		}

		return hashes.map((h, i) => map.get(h) ?? texts[i]);
	}
}
