import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { renderNotificationEmail } from "../../emails/render";
import { PrismaService } from "../../prisma/prisma.service";
import {
	STORAGE_PORT,
	type StoragePort,
} from "../../shared/storage/storage.port";
import type { EnrollableType } from "../enrollment/enrollment.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
	CERTIFICATE_RENDERER,
	type CertificateRendererPort,
} from "./certificate-renderer.port";

const TYPE_LABEL: Record<EnrollableType, string> = {
	course: "Course",
	path: "Learning Path",
	cohort: "Cohort",
};

/**
 * Certificates context (§5.8). Issues a branded PDF when a learner completes a
 * course/path/cohort, stores it in R2, and exposes public QR/URL verification.
 * Issuance is idempotent (one certificate per learner+entity) and independent
 * of Earn-Back — both simply subscribe to the completion event.
 */
@Injectable()
export class CertificatesService {
	private readonly logger = new Logger(CertificatesService.name);

	constructor(
		private readonly prisma: PrismaService,
		@Inject(STORAGE_PORT) private readonly storage: StoragePort,
		@Inject(CERTIFICATE_RENDERER)
		private readonly renderer: CertificateRendererPort,
		private readonly notifications: NotificationsService,
	) {}

	/** Issue (or return the existing) certificate for a completed entity. */
	async issue(
		userId: string,
		entityType: EnrollableType,
		entityId: string,
	): Promise<{ id: string; verifyToken: string }> {
		const existing = await this.prisma.certificate.findFirst({
			where: { userId, entityType, entityId },
			select: { id: true, verifyToken: true },
		});
		if (existing) return existing;

		const [user, content] = await Promise.all([
			this.prisma.user.findUnique({
				where: { id: userId },
				select: {
					fullName: true,
					firstName: true,
					lastName: true,
					tenantId: true,
					email: true,
					phone: true,
					whatsappOptIn: true,
				},
			}),
			this.contentInfo(entityType, entityId),
		]);
		if (!user || !content) {
			throw new NotFoundException("Cannot issue certificate for this content");
		}

		const learnerName =
			user.fullName?.trim() ||
			`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
			"Learner";
		const tenantId = content.tenantId ?? user.tenantId ?? null;
		const verifyToken = randomUUID();
		const frontend = process.env.FRONTEND_URL ?? "http://localhost:5173";
		const platformName = process.env.PLATFORM_NAME ?? "DextaLearning";

		const pdf = await this.renderer.render({
			learnerName,
			contentTitle: content.title,
			contentTypeLabel: TYPE_LABEL[entityType],
			issuedDate: new Date().toLocaleDateString("en-GB", {
				day: "numeric",
				month: "long",
				year: "numeric",
			}),
			verifyUrl: `${frontend}/verify/${verifyToken}`,
			verifyToken,
			platformName,
		});

		const certKey = `certs/${tenantId ?? "default"}/${userId}/${entityType}-${entityId}.pdf`;
		await this.storage.putObject(certKey, pdf, "application/pdf");

		const cert = await this.prisma.certificate.create({
			data: {
				userId,
				entityType,
				entityId,
				tenantId,
				certKey,
				verifyToken,
				learnerName,
				contentTitle: content.title,
			},
			select: { id: true, verifyToken: true },
		});
		// Flag the completion so the hub can surface a "download certificate" CTA.
		await this.prisma.completionStatus.updateMany({
			where: { userId, entityType, entityId },
			data: { certificateIssued: true },
		});

		// §8.6: Certificate issued → learner (in-app + email + optional WhatsApp).
		await this.notifications.notify(userId, {
			type: "certificate_issued",
			dataJson: { title: content.title, entityType },
			inApp: true,
			email: {
				to: user.email,
				subject: `Your certificate for ${content.title} is ready 🎓`,
				html: await renderNotificationEmail({
					preview: `Your certificate for ${content.title} is ready`,
					heading: "Certificate ready 🎓",
					paragraphs: [
						`Congratulations, ${learnerName}!`,
						`You've completed ${content.title} and your certificate is ready to download and share.`,
					],
					cta: "Get my certificate",
					ctaUrl: `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/learn/mine`,
				}),
			},
			...(user.phone && user.whatsappOptIn
				? {
						whatsapp: {
							phone: user.phone,
							message: `🎓 Your certificate for ${content.title} don ready! Check My Learning to download am.`,
						},
					}
				: {}),
			push: {
				title: `Certificate ready 🎓`,
				body: content.title,
				url: "/learn/mine",
				tag: "certificate_issued",
			},
		});

		this.logger.log(
			`Certificate issued: ${entityType}/${entityId} → ${userId}`,
		);
		return cert;
	}

	/** Public verification (§5.8) — no auth; returns only display-safe fields. */
	async verify(token: string) {
		const cert = await this.prisma.certificate.findUnique({
			where: { verifyToken: token },
			select: {
				learnerName: true,
				contentTitle: true,
				entityType: true,
				issuedAt: true,
			},
		});
		if (!cert) return { valid: false as const };
		return {
			valid: true as const,
			learnerName: cert.learnerName,
			contentTitle: cert.contentTitle,
			contentType: cert.entityType,
			issuedAt: cert.issuedAt.toISOString(),
		};
	}

	/** Owner-only signed download URL (2h expiry, §12.6). */
	async downloadUrl(userId: string, certificateId: string): Promise<string> {
		const cert = await this.prisma.certificate.findFirst({
			where: { id: certificateId, userId },
			select: { certKey: true },
		});
		if (!cert?.certKey) throw new NotFoundException("Certificate not found");
		return this.storage.getSignedDownloadUrl(cert.certKey);
	}

	/** The learner's own certificates for their hub. */
	async listMine(userId: string) {
		const rows = await this.prisma.certificate.findMany({
			where: { userId },
			orderBy: { issuedAt: "desc" },
			select: {
				id: true,
				entityType: true,
				entityId: true,
				contentTitle: true,
				issuedAt: true,
				verifyToken: true,
			},
		});
		return rows.map((r) => ({
			...r,
			issuedAt: r.issuedAt.toISOString(),
		}));
	}

	private async contentInfo(
		entityType: EnrollableType,
		entityId: string,
	): Promise<{ title: string; tenantId: string | null } | null> {
		if (entityType === "course") {
			return this.prisma.course.findUnique({
				where: { id: entityId },
				select: { title: true, tenantId: true },
			});
		}
		if (entityType === "path") {
			return this.prisma.learningPath.findUnique({
				where: { id: entityId },
				select: { title: true, tenantId: true },
			});
		}
		return this.prisma.cohort.findUnique({
			where: { id: entityId },
			select: { title: true, tenantId: true },
		});
	}
}
