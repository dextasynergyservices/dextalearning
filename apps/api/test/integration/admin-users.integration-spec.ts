import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { AdminUsersService } from "../../src/modules/admin-users/admin-users.service";
import type { NotificationsService } from "../../src/modules/notifications/notifications.service";
import { getTestPrisma } from "./support/db";
import { createUser } from "./support/factories";

function actorFor(u: { id: string; email: string }): AuthenticatedUser {
	return { id: u.id, email: u.email, role: "admin" };
}

describe("AdminUsersService (integration)", () => {
	const prisma = getTestPrisma();
	const notify = vi.fn().mockResolvedValue(undefined);
	const service = new AdminUsersService(prisma, {
		notify,
	} as unknown as NotificationsService);

	let admin: { id: string; email: string };
	let otherAdmin: { id: string; email: string };
	let learner: { id: string; email: string };
	let actor: AuthenticatedUser;

	beforeEach(async () => {
		// A clean slate: these tests reason about "the last admin", so a stray
		// admin from another spec's fixtures would make them lie.
		await prisma.user.deleteMany({ where: { role: "admin" } });
		admin = await createUser(prisma, { role: "admin" });
		otherAdmin = await createUser(prisma, { role: "admin" });
		learner = await createUser(prisma, { role: "learner" });
		actor = actorFor(admin);
	});

	describe("list", () => {
		it("finds a user by email fragment, case-insensitively", async () => {
			const { rows } = await service.list({
				search: learner.email.slice(0, 8).toUpperCase(),
			});
			expect(rows.some((r) => r.id === learner.id)).toBe(true);
		});

		it("filters by role and reports counts across all roles", async () => {
			const { rows, roleCounts } = await service.list({ role: "admin" });
			expect(rows.every((r) => r.role === "admin")).toBe(true);
			expect(roleCounts.admin).toBe(2);
			expect(roleCounts.learner).toBeGreaterThanOrEqual(1);
		});

		it("filters by suspension status", async () => {
			await service.suspend(actor, learner.id, "spam");
			const suspended = await service.list({ status: "suspended" });
			expect(suspended.rows.some((r) => r.id === learner.id)).toBe(true);
			const active = await service.list({ status: "active" });
			expect(active.rows.some((r) => r.id === learner.id)).toBe(false);
		});

		it("paginates", async () => {
			const { rows, total, page } = await service.list({
				page: 1,
				pageSize: 2,
			});
			expect(rows).toHaveLength(2);
			expect(total).toBeGreaterThanOrEqual(3);
			expect(page).toBe(1);
		});
	});

	describe("setRole", () => {
		it("promotes a learner to instructor", async () => {
			const row = await service.setRole(actor, learner.id, "instructor");
			expect(row.role).toBe("instructor");
		});

		/** Self-demotion locks you out of the only page that could undo it. */
		it("refuses to let an admin change their own role", async () => {
			await expect(service.setRole(actor, admin.id, "learner")).rejects.toThrow(
				/your own role/i,
			);
		});

		/** Losing the last admin is unrecoverable without database surgery. */
		it("refuses to demote the last active admin", async () => {
			// otherAdmin is the only other admin; demote them via their own peer.
			await service.setRole(actorFor(otherAdmin), admin.id, "learner");
			// Now `otherAdmin` is alone. Another admin must do the asking, so use a
			// fresh admin to attempt it and then remove them from the equation.
			const tempActor = actorFor(learner);
			await expect(
				service.setRole(tempActor, otherAdmin.id, "learner"),
			).rejects.toThrow(/last active admin/i);
		});

		it("counts a SUSPENDED admin as no admin at all", async () => {
			// Suspend one of the two admins, leaving exactly one who can sign in.
			await service.suspend(actorFor(otherAdmin), admin.id, "compromised");
			// otherAdmin is now the only admin who can actually log in.
			await expect(
				service.setRole(actorFor(learner), otherAdmin.id, "learner"),
			).rejects.toThrow(/last active admin/i);
		});

		it("rejects a role that isn't assignable here", async () => {
			await expect(
				// facilitator is a per-cohort assignment (§4.7), not a global role.
				service.setRole(actor, learner.id, "facilitator" as "learner"),
			).rejects.toThrow(/unknown role/i);
		});

		it("is a no-op when the role already matches", async () => {
			const row = await service.setRole(actor, learner.id, "learner");
			expect(row.role).toBe("learner");
		});
	});

	describe("suspend / restore", () => {
		it("suspends with a reason and revokes every session", async () => {
			await prisma.session.create({
				data: {
					userId: learner.id,
					token: `t-${learner.id}`,
					expiresAt: new Date(Date.now() + 86_400_000),
				},
			});

			const row = await service.suspend(actor, learner.id, "  spamming  ");
			expect(row.suspendedAt).toBeTruthy();
			expect(row.suspendedReason).toBe("spamming"); // trimmed
			// Without this they'd stay signed in until the cookie expired.
			expect(
				await prisma.session.count({ where: { userId: learner.id } }),
			).toBe(0);
		});

		it("refuses self-suspension", async () => {
			await expect(service.suspend(actor, admin.id)).rejects.toThrow(
				/yourself/i,
			);
		});

		it("refuses to suspend the last active admin", async () => {
			await service.setRole(actorFor(otherAdmin), admin.id, "learner");
			await expect(
				service.suspend(actorFor(learner), otherAdmin.id),
			).rejects.toThrow(/last active admin/i);
		});

		/**
		 * Help, not punishment: the remedy for a compromised account, which must
		 * NOT also bar them from signing back in.
		 */
		it("signs a user out everywhere without suspending them", async () => {
			await prisma.session.createMany({
				data: [
					{
						userId: learner.id,
						token: `a-${learner.id}`,
						expiresAt: new Date(Date.now() + 86_400_000),
					},
					{
						userId: learner.id,
						token: `b-${learner.id}`,
						expiresAt: new Date(Date.now() + 86_400_000),
					},
				],
			});

			const { revoked } = await service.signOutEverywhere(actor, learner.id);

			expect(revoked).toBe(2);
			expect(
				await prisma.session.count({ where: { userId: learner.id } }),
			).toBe(0);
			// The account itself is untouched — they can sign straight back in.
			const after = await prisma.user.findUnique({ where: { id: learner.id } });
			expect(after?.suspendedAt).toBeNull();
		});

		it("reports zero when there was nothing to revoke", async () => {
			const { revoked } = await service.signOutEverywhere(actor, learner.id);
			expect(revoked).toBe(0);
		});

		it("restores access and clears the reason", async () => {
			await service.suspend(actor, learner.id, "mistake");
			const row = await service.restore(actor, learner.id);
			expect(row.suspendedAt).toBeNull();
			expect(row.suspendedReason).toBeNull();
		});

		/**
		 * Suspension is an access decision, not a financial one — money already
		 * owed still settles (§14.3 pays from `instructor_payouts` rows, which
		 * never consult a user's status).
		 */
		it("leaves an instructor's pending payouts untouched", async () => {
			const instructor = await createUser(prisma, { role: "instructor" });
			await prisma.instructorPayout.create({
				data: {
					instructorId: instructor.id,
					amount: 90,
					currency: "NGN",
					status: "pending",
				},
			});

			await service.suspend(actor, instructor.id, "under review");

			const payout = await prisma.instructorPayout.findFirst({
				where: { instructorId: instructor.id },
			});
			expect(payout?.status).toBe("pending");
			expect(Number(payout?.amount)).toBe(90);
		});
	});

	// §5 — authoring is a trusted capability, so an instructor application grants
	// nothing until an admin decides. These assert the gate actually holds.
	describe("instructor applications", () => {
		async function applicant() {
			const user = await createUser(prisma, { role: "learner" });
			await prisma.user.update({
				where: { id: user.id },
				data: { instructorStatus: "pending" },
			});
			return user;
		}

		it("lists only those awaiting a decision", async () => {
			const pending = await applicant();
			const queue = await service.listInstructorApplications();
			expect(queue.map((a) => a.id)).toContain(pending.id);
			// A plain learner who never applied is not in the queue.
			expect(queue.map((a) => a.id)).not.toContain(learner.id);
		});

		it("approving is what grants the instructor role", async () => {
			const pending = await applicant();
			// Until the decision they are a learner — they cannot author anything.
			const before = await prisma.user.findUnique({
				where: { id: pending.id },
			});
			expect(before?.role).toBe("learner");

			await service.decideInstructorApplication(actor, pending.id, true);

			const after = await prisma.user.findUnique({ where: { id: pending.id } });
			expect(after?.role).toBe("instructor");
			expect(after?.instructorStatus).toBe("approved");
			expect(after?.instructorDecidedBy).toBe(admin.id);
			expect(after?.instructorDecidedAt).not.toBeNull();
			expect(notify).toHaveBeenCalledWith(
				pending.id,
				expect.objectContaining({ type: "instructor_approved" }),
			);
		});

		it("rejecting leaves them a learner", async () => {
			const pending = await applicant();
			await service.decideInstructorApplication(actor, pending.id, false);

			const after = await prisma.user.findUnique({ where: { id: pending.id } });
			expect(after?.role).toBe("learner");
			expect(after?.instructorStatus).toBe("rejected");
			expect(notify).toHaveBeenCalledWith(
				pending.id,
				expect.objectContaining({ type: "instructor_rejected" }),
			);
		});

		it("refuses to decide twice — no re-grant after a rejection", async () => {
			const pending = await applicant();
			await service.decideInstructorApplication(actor, pending.id, false);
			await expect(
				service.decideInstructorApplication(actor, pending.id, true),
			).rejects.toThrow(BadRequestException);
			const after = await prisma.user.findUnique({ where: { id: pending.id } });
			expect(after?.role).toBe("learner");
		});

		it("refuses a user who never applied", async () => {
			await expect(
				service.decideInstructorApplication(actor, learner.id, true),
			).rejects.toThrow(BadRequestException);
		});

		/**
		 * Approval must be visible to the rest of the system straight away — the
		 * role is what every guard reads, so this is the whole contract.
		 */
		it("leaves the account genuinely usable as an instructor", async () => {
			const pending = await applicant();
			await service.decideInstructorApplication(actor, pending.id, true);

			const after = await prisma.user.findUnique({ where: { id: pending.id } });
			expect(after?.role).toBe("instructor");
			// Not suspended, and the application is closed rather than lingering.
			expect(after?.suspendedAt).toBeNull();
			expect(after?.instructorStatus).toBe("approved");
			// And they show up as an instructor in the admin listing.
			const { rows } = await service.list({ role: "instructor" });
			expect(rows.some((r) => r.id === pending.id)).toBe(true);
		});
	});
});
