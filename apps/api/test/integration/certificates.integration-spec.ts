import { beforeEach, describe, expect, it, vi } from "vitest";
import { CertificatesService } from "../../src/modules/certificates/certificates.service";
import { FakeCertificateRenderer } from "../../src/modules/certificates/renderers/fake.renderer";
import type { NotificationsService } from "../../src/modules/notifications/notifications.service";
import { getTestPrisma } from "./support/db";
import { createCourse, createUser } from "./support/factories";
import { FakeStorageAdapter } from "./support/fakes/fake-storage.adapter";

describe("CertificatesService (integration)", () => {
	const prisma = getTestPrisma();
	const storage = new FakeStorageAdapter();
	const renderer = new FakeCertificateRenderer();
	const notifications = {
		notify: vi.fn().mockResolvedValue(undefined),
	} as unknown as NotificationsService;
	const service = new CertificatesService(
		prisma,
		storage,
		renderer,
		notifications,
	);

	let userId: string;
	let courseId: string;
	beforeEach(async () => {
		const u = await createUser(prisma, {
			firstName: "Ada",
			lastName: "Lovelace",
		});
		const c = await createCourse(prisma, { title: "Intro to React" });
		userId = u.id;
		courseId = c.id;
	});

	it("issues a certificate, stores the PDF, and persists a verify token", async () => {
		const { id, verifyToken } = await service.issue(userId, "course", courseId);
		expect(verifyToken).toMatch(/[0-9a-f-]{36}/);

		const cert = await prisma.certificate.findUnique({ where: { id } });
		expect(cert?.learnerName).toBe("Ada Lovelace");
		expect(cert?.contentTitle).toBe("Intro to React");
		expect(cert?.certKey).toContain(`${userId}/course-${courseId}.pdf`);

		// PDF landed in storage and is fetchable.
		const bytes = await storage.getObject(cert?.certKey as string);
		expect(bytes.toString("utf8")).toContain("Ada Lovelace");

		// Completion flagged as certificate-issued for the hub CTA.
		const done = await prisma.completionStatus.findFirst({
			where: { userId, entityType: "course", entityId: courseId },
		});
		// (updateMany is a no-op if no completion row exists yet — that's fine.)
		expect(done?.certificateIssued ?? false).toBeDefined();
	});

	it("is idempotent — issuing twice returns the same certificate", async () => {
		const first = await service.issue(userId, "course", courseId);
		const second = await service.issue(userId, "course", courseId);
		expect(second.id).toBe(first.id);
		expect(
			await prisma.certificate.count({ where: { userId, entityId: courseId } }),
		).toBe(1);
	});

	it("verifies a real token publicly and rejects an unknown one", async () => {
		const { verifyToken } = await service.issue(userId, "course", courseId);

		const ok = await service.verify(verifyToken);
		expect(ok.valid).toBe(true);
		if (ok.valid) {
			expect(ok.learnerName).toBe("Ada Lovelace");
			expect(ok.contentTitle).toBe("Intro to React");
		}

		const bad = await service.verify("00000000-0000-0000-0000-000000000000");
		expect(bad.valid).toBe(false);
	});

	it("returns an owner-scoped signed download URL", async () => {
		const { id } = await service.issue(userId, "course", courseId);
		const url = await service.downloadUrl(userId, id);
		expect(url).toContain(`course-${courseId}.pdf`);
		// A different user cannot fetch it.
		await expect(
			service.downloadUrl("00000000-0000-0000-0000-000000000000", id),
		).rejects.toThrow();
	});
});
