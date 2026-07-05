import "dotenv/config";

if (!process.env.TEST_DATABASE_URL) {
	throw new Error(
		"TEST_DATABASE_URL is not set. Add it to apps/api/.env (see .env.example) " +
			"and run `bun run db:test:push`.",
	);
}
// Two separate Prisma clients read DATABASE_URL at construction/import time —
// Nest's own PrismaService AND Better Auth's standalone client in
// src/auth/auth.config.ts — so this must run before either is ever imported.
// Vitest guarantees setupFiles finish before a spec file's own imports
// evaluate, which is what makes this safe without further tricks.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
