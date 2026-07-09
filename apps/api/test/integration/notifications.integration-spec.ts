import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { NotificationsService } from "../../src/modules/notifications/notifications.service";
import { getTestPrisma } from "./support/db";
import { createUser } from "./support/factories";
import { FakeNotificationAdapter } from "./support/fakes/fake-notification.adapter";

function asAuthenticatedUser(id: string): AuthenticatedUser {
	return { id, email: `${id}@example.com`, role: "learner" };
}

describe("NotificationsService (integration)", () => {
	const prisma = getTestPrisma();
	const port = new FakeNotificationAdapter();
	const service = new NotificationsService(prisma, port);

	let userId: string;

	beforeEach(async () => {
		port.reset();
		userId = (await createUser(prisma, { role: "learner" })).id;
	});

	it("notify writes the in-app row and fans out to the requested channels", async () => {
		await service.notify(userId, {
			type: "reminder_digest",
			dataJson: { reviewCount: 2, streakAtRisk: true },
			inApp: true,
			email: { to: "a@b.com", subject: "Keep it up", html: "<p>hi</p>" },
			whatsapp: { phone: "+2348000000000", message: "Streak time 🔥" },
		});

		const rows = await prisma.notification.findMany({ where: { userId } });
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ type: "reminder_digest", readAt: null });
		expect(port.emails).toEqual([
			{ to: "a@b.com", subject: "Keep it up", html: "<p>hi</p>" },
		]);
		expect(port.whatsapps).toEqual([
			{ phone: "+2348000000000", message: "Streak time 🔥" },
		]);
	});

	it("skips channels that weren't requested", async () => {
		await service.notify(userId, { type: "badge_awarded", inApp: true });
		expect(port.emails).toHaveLength(0);
		expect(port.whatsapps).toHaveLength(0);
		expect(await prisma.notification.count({ where: { userId } })).toBe(1);
	});

	it("channel failures are swallowed — remaining channels still deliver", async () => {
		port.failEmail = true;
		await expect(
			service.notify(userId, {
				type: "reminder_digest",
				inApp: true,
				email: { to: "a@b.com", subject: "s", html: "h" },
				whatsapp: { phone: "+234", message: "m" },
			}),
		).resolves.toBeUndefined();
		// Email died; in-app row and WhatsApp still went through.
		expect(await prisma.notification.count({ where: { userId } })).toBe(1);
		expect(port.whatsapps).toHaveLength(1);
	});

	it("lists newest-first with cursor pagination and an unread count; read endpoints scope to the owner", async () => {
		for (let i = 0; i < 3; i++) {
			await service.notify(userId, { type: `t${i}`, inApp: true });
		}
		const page1 = await service.list(asAuthenticatedUser(userId), 2);
		expect(page1.notifications).toHaveLength(2);
		expect(page1.unreadCount).toBe(3);
		expect(page1.nextCursor).toBeTruthy();

		const page2 = await service.list(
			asAuthenticatedUser(userId),
			2,
			page1.nextCursor as string,
		);
		expect(page2.notifications).toHaveLength(1);
		expect(page2.nextCursor).toBeNull();

		// Another user cannot mark someone else's notification read.
		const stranger = await createUser(prisma, { role: "learner" });
		await service.markRead(
			asAuthenticatedUser(stranger.id),
			page1.notifications[0].id,
		);
		expect(
			await prisma.notification.count({ where: { userId, readAt: null } }),
		).toBe(3);

		await service.markRead(
			asAuthenticatedUser(userId),
			page1.notifications[0].id,
		);
		await service.markAllRead(asAuthenticatedUser(userId));
		expect(
			await prisma.notification.count({ where: { userId, readAt: null } }),
		).toBe(0);
	});
});
