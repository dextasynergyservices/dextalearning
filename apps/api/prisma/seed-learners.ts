import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { auth } from "../src/auth/auth.config";

// Two extra demo learners for testing multi-learner flows (groups, leaderboards,
// peer review, etc.). Run with `bun run prisma:seed:learners`. Idempotent:
// removes each learner first, then recreates via Better Auth so the
// password/account records are real (proper hashing).

const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const PASSWORD = "DemoPass123!";
const LEARNERS = [
	{ email: "ada@dextalearning.com", first: "Ada", last: "Learner" },
	{ email: "ben@dextalearning.com", first: "Ben", last: "Learner" },
];

async function main(): Promise<void> {
	const teachers = await prisma.tenant.findUnique({
		where: { slug: "teachers" },
	});

	for (const { email, first, last } of LEARNERS) {
		// Clear dependent rows first (enrolment/completion FKs are RESTRICT), then
		// the user — so a re-seed is clean even after the learner enrolled.
		const existing = await prisma.user.findUnique({
			where: { email },
			select: { id: true },
		});
		if (existing) {
			const uid = existing.id;
			await prisma.courseEnrollment.deleteMany({ where: { userId: uid } });
			await prisma.pathEnrollment.deleteMany({ where: { userId: uid } });
			await prisma.cohortEnrollment.deleteMany({ where: { userId: uid } });
			await prisma.lessonCompletion.deleteMany({ where: { userId: uid } });
			await prisma.completionStatus.deleteMany({ where: { userId: uid } });
		}
		await prisma.user.deleteMany({ where: { email } });

		await auth.api.signUpEmail({
			body: {
				email,
				password: PASSWORD,
				name: `${first} ${last}`,
				firstName: first,
				lastName: last,
			},
		});

		const learner = await prisma.user.update({
			where: { email },
			data: {
				emailVerified: true,
				tenantId: teachers?.id ?? null,
				language: "en",
			},
			select: { id: true, email: true, role: true, name: true },
		});

		console.log(`✓ ${learner.name}  —  ${email} / ${PASSWORD}`);
	}
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (error) => {
		console.error("Learners seed failed:", error);
		await prisma.$disconnect();
		process.exit(1);
	});
