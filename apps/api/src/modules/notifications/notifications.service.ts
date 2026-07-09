import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma/client";
import type { AuthenticatedUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";
import {
	NOTIFICATION_PORT,
	type NotificationPort,
} from "../../shared/notifications/notification.port";

export interface NotifyInput {
	/** Client-side i18n discriminator, e.g. "reminder_digest". */
	type: string;
	/** Structured payload the client renders — no display copy stored. */
	dataJson?: Prisma.InputJsonValue;
	/** Write an in-app row (the §8.6 "In-App" column). */
	inApp: boolean;
	email?: { to: string; subject: string; html: string };
	whatsapp?: { phone: string; message: string };
}

/**
 * Notifications context (§6.4): the single entry point other contexts use to
 * reach a user. Callers express the §8.6 channel matrix per notification;
 * this service persists the in-app row and fans out through the
 * `NotificationPort`. Channel failures are logged, never thrown — a dead
 * email provider must not fail the caller's workflow.
 */
@Injectable()
export class NotificationsService {
	private readonly logger = new Logger(NotificationsService.name);

	constructor(
		private readonly prisma: PrismaService,
		@Inject(NOTIFICATION_PORT) private readonly port: NotificationPort,
	) {}

	async notify(userId: string, input: NotifyInput): Promise<void> {
		if (input.inApp) {
			try {
				await this.prisma.notification.create({
					data: {
						userId,
						type: input.type,
						dataJson: input.dataJson,
					},
				});
			} catch (error) {
				this.logger.error(`in-app notification failed: ${String(error)}`);
			}
		}
		if (input.email) {
			try {
				await this.port.sendEmail(
					input.email.to,
					input.email.subject,
					input.email.html,
				);
			} catch (error) {
				this.logger.error(`email channel failed: ${String(error)}`);
			}
		}
		if (input.whatsapp) {
			try {
				await this.port.sendWhatsapp(
					input.whatsapp.phone,
					input.whatsapp.message,
				);
			} catch (error) {
				this.logger.error(`whatsapp channel failed: ${String(error)}`);
			}
		}
	}

	async list(user: AuthenticatedUser, limit: number, cursor?: string) {
		const take = Math.max(1, Math.min(50, limit));
		const rows = await this.prisma.notification.findMany({
			where: { userId: user.id },
			orderBy: { createdAt: "desc" },
			take: take + 1,
			...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
		});
		const page = rows.slice(0, take);
		const unread = await this.prisma.notification.count({
			where: { userId: user.id, readAt: null },
		});
		return {
			notifications: page.map((n) => ({
				id: n.id,
				type: n.type,
				data: n.dataJson,
				readAt: n.readAt,
				createdAt: n.createdAt,
			})),
			nextCursor: rows.length > take ? page[page.length - 1]?.id : null,
			unreadCount: unread,
		};
	}

	async markRead(user: AuthenticatedUser, id: string) {
		await this.prisma.notification.updateMany({
			where: { id, userId: user.id, readAt: null },
			data: { readAt: new Date() },
		});
		return { ok: true as const };
	}

	async markAllRead(user: AuthenticatedUser) {
		await this.prisma.notification.updateMany({
			where: { userId: user.id, readAt: null },
			data: { readAt: new Date() },
		});
		return { ok: true as const };
	}
}
