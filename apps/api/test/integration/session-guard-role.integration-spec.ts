import type { ExecutionContext } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionGuard } from "../../src/auth/guards/session.guard";
import type { AuthenticatedUser } from "../../src/auth/types";
import { getTestPrisma } from "./support/db";
import { createUser } from "./support/factories";

// The guard resolves the session through Better Auth; stub that so these specs
// isolate what we actually changed — which source of truth the ROLE comes from.
const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
vi.mock("../../src/auth/auth.config", () => ({
	auth: { api: { getSession: getSessionMock } },
}));

/**
 * Approving an instructor application changes `users.role` in the database, but
 * the applicant is still holding a session minted when they were a learner. If
 * the guard trusted that payload, approval would appear to do nothing until the
 * session happened to refresh — and with `secondaryStorage` on, the stale copy
 * lives in Redis. These pin the rule: the database wins.
 */
describe("SessionGuard role resolution (integration)", () => {
	const prisma = getTestPrisma();
	const guard = new SessionGuard(prisma);

	function contextFor() {
		const request: {
			headers: Record<string, string>;
			user?: AuthenticatedUser;
		} = { headers: {} };
		return {
			ctx: {
				switchToHttp: () => ({ getRequest: () => request }),
			} as unknown as ExecutionContext,
			request,
		};
	}

	beforeEach(() => {
		getSessionMock.mockReset();
	});

	it("prefers the database role over a stale session role", async () => {
		// Approved in the database…
		const user = await createUser(prisma, { role: "instructor" });
		// …but still carrying the session they had as a learner.
		getSessionMock.mockResolvedValue({
			session: { id: "s1" },
			user: { id: user.id, email: user.email, role: "learner" },
		});

		const { ctx, request } = contextFor();
		await expect(guard.canActivate(ctx)).resolves.toBe(true);
		expect(request.user?.role).toBe("instructor");
	});

	it("does not let a stale session keep a revoked capability", async () => {
		// The reverse case: demoted in the database, session still says instructor.
		const user = await createUser(prisma, { role: "learner" });
		getSessionMock.mockResolvedValue({
			session: { id: "s1" },
			user: { id: user.id, email: user.email, role: "instructor" },
		});

		const { ctx, request } = contextFor();
		await guard.canActivate(ctx);
		expect(request.user?.role).toBe("learner");
	});
});
