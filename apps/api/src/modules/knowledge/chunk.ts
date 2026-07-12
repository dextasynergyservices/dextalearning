/**
 * Split lesson prose into embedding-sized passages (§4.10 RAG). Pure + framework-
 * free (§6.4 rule 4). Greedily packs sentence/line units up to `maxChars`;
 * over-long units are hard-split; total chunks are capped so a huge transcript
 * can't explode the embedding batch.
 */
export interface ChunkOptions {
	maxChars?: number;
	maxChunks?: number;
}

export function chunkText(input: string, opts: ChunkOptions = {}): string[] {
	const maxChars = opts.maxChars ?? 1200;
	const maxChunks = opts.maxChunks ?? 80;
	const text = input.replace(/\r\n/g, "\n").trim();
	if (!text) return [];

	const units = text
		.split(/\n+|(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter(Boolean);

	const chunks: string[] = [];
	let current = "";
	const flush = () => {
		if (current) {
			chunks.push(current);
			current = "";
		}
	};

	for (const unit of units) {
		if (unit.length > maxChars) {
			flush();
			for (let i = 0; i < unit.length; i += maxChars) {
				chunks.push(unit.slice(i, i + maxChars));
			}
			continue;
		}
		if (current && current.length + 1 + unit.length > maxChars) {
			flush();
			current = unit;
		} else {
			current = current ? `${current} ${unit}` : unit;
		}
	}
	flush();

	return chunks.slice(0, maxChunks);
}
