import "dotenv/config";
import { beforeEach } from "vitest";
import { getTestPrisma } from "./support/db";
import { resetDatabase } from "./support/reset-db";

if (!process.env.TEST_DATABASE_URL) {
	throw new Error(
		"TEST_DATABASE_URL is not set. Add it to apps/api/.env (see .env.example) " +
			"and run `bun run db:test:push`.",
	);
}
// Every integration spec's PrismaService must connect to the disposable test
// DB, never the dev one — this runs before any spec file's own imports.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

// Force the Fake payment gateway in tests: clearing the provider keys makes the
// PaymentGatewayRegistry fall back to FakeGatewayAdapter, so the checkout →
// webhook → settlement flow runs deterministically with no live network calls.
process.env.PAYSTACK_SECRET_KEY = "";
process.env.STRIPE_SECRET_KEY = "";
process.env.STRIPE_WEBHOOK_SECRET = "";

beforeEach(async () => {
	await resetDatabase(getTestPrisma());
});
