import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { auth } from "../src/auth/auth.config";

// Standalone demo seed (run with `bun run prisma:seed:learner`). Creates a
// verified learner you can sign in with once the frontend auth is wired.
// Idempotent: removes the demo learner first, then recreates it via Better Auth
// so the password/account records are real.

const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const EMAIL = "learner@dextalearning.com";
const PASSWORD = "Password1";

async function main(): Promise<void> {
	// Cascade removes any existing account/session for a clean re-seed.
	await prisma.user.deleteMany({ where: { email: EMAIL } });

	await auth.api.signUpEmail({
		body: {
			email: EMAIL,
			password: PASSWORD,
			name: "Demo Learner",
			firstName: "Demo",
			lastName: "Learner",
		},
	});

	const teachers = await prisma.tenant.findUnique({
		where: { slug: "teachers" },
	});

	const learner = await prisma.user.update({
		where: { email: EMAIL },
		data: {
			emailVerified: true,
			tenantId: teachers?.id ?? null,
			language: "en",
		},
		select: { id: true, email: true, role: true, name: true },
	});

	console.log("✓ Demo learner ready:");
	console.log(`   email:    ${EMAIL}`);
	console.log(`   password: ${PASSWORD}`);
	console.log(`   record:   ${JSON.stringify(learner)}`);
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (error) => {
		console.error("Learner seed failed:", error);
		await prisma.$disconnect();
		process.exit(1);
	});
