import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { renderNotificationEmail } from "../../emails/render";
import { PrismaService } from "../../prisma/prisma.service";
import {
	type EarnBackFailedEvent,
	type EarnBackNoPayoutEvent,
	type EarnBackProcessedEvent,
	PaymentEvents,
	type PayoutFailedEvent,
	type PayoutProcessedEvent,
} from "../../shared/events/payment-events";
import { NotificationsService } from "../notifications/notifications.service";

/** Where email CTAs point. Same source the checkout callback URL uses. */
function appUrl(): string {
	return process.env.FRONTEND_URL ?? "http://localhost:5173";
}

/**
 * Payments' outbound notification edge (§6.4, §8.5, §8.6). Turns payout domain
 * events into the instructor's email + WhatsApp + in-app messages. Reads only
 * the recipient's contact fields — the money figures ride on the event payload,
 * never re-joined from the payout tables (§6.4 rule 5). A failed payout also
 * alerts Admins so support can step in.
 */
@Injectable()
export class PaymentsNotificationsHandler {
	constructor(
		private readonly prisma: PrismaService,
		private readonly notifications: NotificationsService,
	) {}

	private money(amount: number, currency: string): string {
		return `${currency} ${amount.toLocaleString("en-NG", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		})}`;
	}

	@OnEvent(PaymentEvents.PayoutProcessed)
	async onPayoutProcessed(event: PayoutProcessedEvent): Promise<void> {
		const user = await this.contact(event.instructorId);
		if (!user) return;
		const amount = this.money(event.amount, event.currency);
		await this.notifications.notify(event.instructorId, {
			type: "payout_processed",
			dataJson: {
				amount: event.amount,
				currency: event.currency,
				entityTitle: event.entityTitle,
				learnerName: event.learnerName,
			},
			inApp: true,
			email: {
				to: user.email,
				subject: `${amount} received — ${event.entityTitle}`,
				html: await renderNotificationEmail({
					preview: `${amount} is on its way to your account`,
					heading: "You got paid 💸",
					paragraphs: [
						`${amount} has been credited for the ${event.entityTitle} enrolment by ${event.learnerName}.`,
					],
					cta: "View my earnings",
					ctaUrl: `${appUrl()}/instructor/earnings`,
				}),
			},
			...(user.phone && user.whatsappOptIn
				? {
						whatsapp: {
							phone: user.phone,
							message: `${amount} don land for ${event.entityTitle}! 🎉 Check your DextaLearning earnings.`,
						},
					}
				: {}),
			push: {
				title: `New earning: ${amount}`,
				body: `From ${event.entityTitle}`,
				url: "/instructor/earnings",
				tag: "payout_processed",
			},
		});
	}

	@OnEvent(PaymentEvents.PayoutFailed)
	async onPayoutFailed(event: PayoutFailedEvent): Promise<void> {
		const user = await this.contact(event.instructorId);
		if (user) {
			await this.notifications.notify(event.instructorId, {
				type: "payout_failed",
				dataJson: {
					amount: event.amount,
					currency: event.currency,
					entityTitle: event.entityTitle,
				},
				inApp: true,
				email: {
					to: user.email,
					subject: "We had an issue with your payout",
					html: await renderNotificationEmail({
						preview: `Your payout for ${event.entityTitle} needs a second look`,
						heading: "We had an issue with your payout",
						paragraphs: [
							`We hit a snag paying out your earnings for ${event.entityTitle}.`,
							"Our team is on it and will be in touch — no action needed from you.",
						],
						cta: "View my earnings",
						ctaUrl: `${appUrl()}/instructor/earnings`,
					}),
				},
				...(user.phone && user.whatsappOptIn
					? {
							whatsapp: {
								phone: user.phone,
								message: `We had an issue with your DextaLearning payout for ${event.entityTitle}. Our team dey work on am.`,
							},
						}
					: {}),
			});
		}

		// Alert Admins so a support ticket can be opened (§14.2).
		const admins = await this.prisma.user.findMany({
			where: { role: "admin" },
			select: { id: true, email: true },
		});
		await Promise.all(
			admins.map(async (a) =>
				this.notifications.notify(a.id, {
					type: "payout_failed_admin",
					dataJson: {
						payoutId: event.payoutId,
						instructorId: event.instructorId,
						amount: event.amount,
						currency: event.currency,
						reason: event.reason,
					},
					inApp: true,
					email: {
						to: a.email,
						subject: `Payout failed — ${event.entityTitle}`,
						html: await renderNotificationEmail({
							preview: `An instructor payout for ${event.entityTitle} failed`,
							heading: "Payout failed — action needed",
							paragraphs: [
								`Instructor payout ${event.payoutId} failed: ${event.reason}.`,
								"Please review it and open a support ticket.",
							],
							cta: "Review payouts",
							ctaUrl: `${appUrl()}/admin/payouts`,
						}),
					},
				}),
			),
		);
	}

	@OnEvent(PaymentEvents.EarnBackProcessed)
	async onEarnBackProcessed(event: EarnBackProcessedEvent): Promise<void> {
		const user = await this.contact(event.userId);
		if (!user) return;
		const amount = this.money(event.amount, event.currency);
		await this.notifications.notify(event.userId, {
			type: "earn_back_processed",
			dataJson: {
				amount: event.amount,
				currency: event.currency,
				entityTitle: event.entityTitle,
				daysLate: event.daysLate,
			},
			inApp: true,
			email: {
				to: user.email,
				subject: `Your Earn-Back of ${amount} is on its way! 🎉`,
				html: await renderNotificationEmail({
					preview: `${amount} is on its way back to your card`,
					heading: "Earn-Back on its way 🎉",
					paragraphs: [
						`Congratulations on completing ${event.entityTitle}!`,
						`Your Earn-Back of ${amount} is on its way back to your original payment method.`,
						// Say when. Without this the learner watches their bank for a
						// refund we've already sent and assumes it's lost.
						"Refunds usually land within 5–10 business days, depending on your bank.",
					],
					cta: "View my learning",
					ctaUrl: `${appUrl()}/learn/mine`,
				}),
			},
			...(user.phone && user.whatsappOptIn
				? {
						whatsapp: {
							phone: user.phone,
							message: `Your Earn-Back of ${amount} for ${event.entityTitle} dey come! 🎉`,
						},
					}
				: {}),
			push: {
				title: `Earn-Back on its way: ${amount}`,
				body: event.entityTitle,
				url: "/learn/mine",
				tag: "earn_back_processed",
			},
		});
	}

	@OnEvent(PaymentEvents.EarnBackNoPayout)
	async onEarnBackNoPayout(event: EarnBackNoPayoutEvent): Promise<void> {
		const user = await this.contact(event.userId);
		if (!user) return;
		await this.notifications.notify(event.userId, {
			type: "earn_back_no_payout",
			dataJson: { entityTitle: event.entityTitle },
			inApp: true,
			email: {
				to: user.email,
				subject: `Course complete — ${event.entityTitle}`,
				html: await renderNotificationEmail({
					preview: `You finished ${event.entityTitle} — your certificate is ready`,
					heading: "Course complete 🎓",
					paragraphs: [
						`Well done finishing ${event.entityTitle}!`,
						"There's no Earn-Back remaining on this one, but your certificate is ready.",
					],
					cta: "Get my certificate",
					ctaUrl: `${appUrl()}/learn/mine`,
				}),
			},
			...(user.phone && user.whatsappOptIn
				? {
						whatsapp: {
							phone: user.phone,
							message: `You don finish ${event.entityTitle}! No Earn-Back remain, but your certificate ready. 🎓`,
						},
					}
				: {}),
		});
	}

	@OnEvent(PaymentEvents.EarnBackFailed)
	async onEarnBackFailed(event: EarnBackFailedEvent): Promise<void> {
		const user = await this.contact(event.userId);
		if (user) {
			await this.notifications.notify(event.userId, {
				type: "earn_back_failed",
				dataJson: {
					amount: event.amount,
					currency: event.currency,
					entityTitle: event.entityTitle,
				},
				inApp: true,
				email: {
					to: user.email,
					subject: "We're processing your Earn-Back",
					html: await renderNotificationEmail({
						preview: `Your Earn-Back for ${event.entityTitle} needs a second look`,
						heading: "We're processing your Earn-Back",
						paragraphs: [
							`We're still processing your Earn-Back for ${event.entityTitle}.`,
							"Our team will be in touch shortly — your refund isn't lost, and there's nothing you need to do.",
						],
						cta: "View my learning",
						ctaUrl: `${appUrl()}/learn/mine`,
					}),
				},
			});
		}
		const admins = await this.prisma.user.findMany({
			where: { role: "admin" },
			select: { id: true, email: true },
		});
		await Promise.all(
			admins.map(async (a) =>
				this.notifications.notify(a.id, {
					type: "earn_back_failed_admin",
					dataJson: {
						transactionId: event.transactionId,
						userId: event.userId,
						amount: event.amount,
						currency: event.currency,
						reason: event.reason,
					},
					inApp: true,
					email: {
						to: a.email,
						subject: `Earn-Back refund failed — ${event.entityTitle}`,
						html: await renderNotificationEmail({
							preview: `A learner's Earn-Back refund for ${event.entityTitle} failed`,
							heading: "Earn-Back refund failed — action needed",
							paragraphs: [
								`Earn-Back ${event.transactionId} failed: ${event.reason}.`,
								"A learner is owed this money. Please review it and open a support ticket.",
							],
							cta: "Review refunds",
							ctaUrl: `${appUrl()}/admin/payouts`,
						}),
					},
				}),
			),
		);
	}

	private contact(userId: string) {
		return this.prisma.user.findUnique({
			where: { id: userId },
			select: { email: true, phone: true, whatsappOptIn: true },
		});
	}
}
