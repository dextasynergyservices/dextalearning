import { PrismaService } from "../../../src/prisma/prisma.service";

/**
 * Shared Prisma connection for all integration specs, lazily constructed.
 * `setup.ts` forces `DATABASE_URL` to `TEST_DATABASE_URL` before anything
 * calls this — a lazy singleton (rather than `export const testPrisma = new
 * PrismaService()`) guarantees that ordering, since ESM import hoisting would
 * otherwise construct `PrismaService` (reading `DATABASE_URL`) before setup's
 * env override runs.
 */
let instance: PrismaService | null = null;

export function getTestPrisma(): PrismaService {
	if (!instance) instance = new PrismaService();
	return instance;
}
