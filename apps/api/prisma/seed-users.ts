import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { auth } from "../src/auth/auth.config";

// Demo accounts for walking the platform (run with `bun run prisma:seed:users`).
// All verified, password `Password1`, attached to the `teachers` tenant.
// Roles are set after Better Auth sign-up (sign-up always creates a learner).

const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const USERS = [
	{
		email: "learner@dextalearning.com",
		firstName: "Demo",
		lastName: "Learner",
		role: "learner" as const,
	},
	{
		email: "instructor@dextalearning.com",
		firstName: "Demo",
		lastName: "Instructor",
		role: "instructor" as const,
	},
	{
		email: "admin@dextalearning.com",
		firstName: "Demo",
		lastName: "Admin",
		role: "admin" as const,
	},
];

const PASSWORD = "DemoPass123!";

async function main(): Promise<void> {
	const teachers = await prisma.tenant.findUnique({
		where: { slug: "teachers" },
	});

	for (const u of USERS) {
		await prisma.user.deleteMany({ where: { email: u.email } });
		await auth.api.signUpEmail({
			body: {
				email: u.email,
				password: PASSWORD,
				name: `${u.firstName} ${u.lastName}`,
				firstName: u.firstName,
				lastName: u.lastName,
			},
		});
		await prisma.user.update({
			where: { email: u.email },
			data: {
				emailVerified: true,
				role: u.role,
				tenantId: teachers?.id ?? null,
				language: "en",
			},
		});
		console.log(`✓ ${u.role.padEnd(10)} ${u.email}  /  ${PASSWORD}`);
	}
}

main()
	.then(() => prisma.$disconnect())
	.catch(async (error) => {
		console.error("Seed failed:", error);
		await prisma.$disconnect();
		process.exit(1);
	});
