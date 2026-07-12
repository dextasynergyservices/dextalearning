import { createHash } from "node:crypto";

/**
 * Short, stable content hash for cache keys (§5 AI response cache). Including a
 * transcript/question hash in the key means stale content simply misses — no
 * manual invalidation needed.
 */
export function shortHash(input: string): string {
	return createHash("sha1").update(input).digest("hex").slice(0, 12);
}
