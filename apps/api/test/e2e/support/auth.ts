import { randomUUID } from "node:crypto";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import type { PrismaService } from "../../../src/prisma/prisma.service";

export interface RegisterOverrides {
	email?: string;
	password?: string;
	firstName?: string;
	lastName?: string;
	role?: "learner" | "instructor";
}

/**
 * Registers + logs in a real user through the app's own HTTP endpoints, so
 * tests exercise the genuine `SessionGuard` → `auth.api.getSession()` path —
 * not a bypass. `requireEmailVerification: true` blocks sign-in for a fresh
 * sign-up, so the one shortcut is flipping `emailVerified` directly in the
 * test DB between register and sign-in (verification's own flow is out of
 * scope here). Returns a supertest **agent** (persists the real
 * `better-auth.session_token` cookie across requests).
 */
export async function registerAndLogin(
	app: NestExpressApplication,
	prisma: PrismaService,
	overrides: RegisterOverrides = {},
): Promise<{ agent: ReturnType<typeof request.agent>; userId: string }> {
	const agent = request.agent(app.getHttpServer());
	const email = overrides.email ?? `user-${randomUUID()}@example.com`;
	const password = overrides.password ?? "TestPassword123!";

	const registerRes = await agent
		.post("/api/v1/auth/register")
		.send({
			email,
			password,
			confirmPassword: password,
			firstName: overrides.firstName ?? "Test",
			lastName: overrides.lastName ?? "User",
			role: overrides.role ?? "learner",
		})
		.expect(201);
	const userId = registerRes.body.data.userId as string;

	await prisma.user.update({
		where: { id: userId },
		data: { emailVerified: true },
	});

	await agent
		.post("/api/auth/sign-in/email")
		.send({ email, password })
		.expect(200);

	return { agent, userId };
}
