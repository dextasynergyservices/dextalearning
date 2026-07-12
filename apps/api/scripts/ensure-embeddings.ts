/**
 * Provision the `content_embeddings` table + pgvector extension + HNSW index in
 * whichever database `DATABASE_URL` points to (§4.10 RAG). Idempotent, so it's
 * safe to run against dev or prod repeatedly. The API also does this on boot via
 * KnowledgeModule.onModuleInit(); this script is for locked-down roles or a
 * one-off ops step. Run with: `bun run db:embeddings`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import "dotenv/config";
import { Client } from "pg";

async function main(): Promise<void> {
	const url = process.env.DATABASE_URL;
	if (!url) {
		throw new Error("DATABASE_URL is not set (apps/api/.env).");
	}
	const sql = readFileSync(
		join(process.cwd(), "prisma", "sql", "content_embeddings.sql"),
		"utf8",
	);
	const client = new Client({ connectionString: url });
	await client.connect();
	try {
		await client.query(sql);
		console.log("✓ content_embeddings provisioned");
	} finally {
		await client.end();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
