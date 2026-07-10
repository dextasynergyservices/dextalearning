import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import {
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
	NOTIFICATION_PORT,
	type NotificationPort,
} from "../../shared/notifications/notification.port";

/** How long a code stays valid (§8.6 — short-lived ownership proof). */
const CODE_TTL_MS = 10 * 60 * 1000;
/** Minimum gap between sends, so "Resend" can't be spammed. */
const RESEND_COOLDOWN_MS = 60 * 1000;
/** Wrong-code guesses allowed before a fresh code is required. */
const MAX_ATTEMPTS = 5;

type Channel = "whatsapp" | "sms";

/**
 * Phone-number ownership verification via a WhatsApp/SMS one-time code.
 *
 * Self-contained context: it reads/writes only `users.phone` /
 * `users.phone_verified` and owns the `phone_verifications` challenge table,
 * reaching the outside world solely through the `NotificationPort`. Codes are
 * stored hashed (salted per user); comparison is constant-time.
 */
@Injectable()
export class PhoneVerificationService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
	) {}

	private hash(userId: string, code: string): string {
		return createHash("sha256").update(`${userId}:${code}`).digest("hex");
	}

	/**
	 * Issue a code and deliver it over the chosen channel. Idempotent per user:
	 * a new send replaces any pending challenge and resets the attempt counter.
	 */
	async sendCode(userId: string, channel: Channel = "whatsapp") {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { phone: true, phoneVerified: true },
		});
		if (!user) throw new NotFoundException("User not found");
		if (!user.phone) {
			throw new UnprocessableEntityException({
				code: "PHONE_REQUIRED",
				message: "Add a phone number to your profile before verifying it.",
			});
		}
		if (user.phoneVerified) {
			return { status: "already_verified" as const };
		}

		const existing = await this.prisma.phoneVerification.findUnique({
			where: { userId },
		});
		// Enforce the resend cooldown only while a still-valid code exists for the
		// same number — a changed number always sends immediately.
		if (
			existing &&
			existing.phone === user.phone &&
			existing.expiresAt.getTime() > Date.now()
		) {
			const elapsed = Date.now() - existing.lastSentAt.getTime();
			if (elapsed < RESEND_COOLDOWN_MS) {
				throw new HttpException(
					{
						code: "RESEND_COOLDOWN",
						message: "Please wait before requesting another code.",
						details: {
							retryAfterSeconds: Math.ceil(
								(RESEND_COOLDOWN_MS - elapsed) / 1000,
							),
						},
					},
					HttpStatus.TOO_MANY_REQUESTS,
				);
			}
		}

		const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
		const expiresAt = new Date(Date.now() + CODE_TTL_MS);
		await this.prisma.phoneVerification.upsert({
			where: { userId },
			create: {
				userId,
				phone: user.phone,
				codeHash: this.hash(userId, code),
				expiresAt,
				lastSentAt: new Date(),
			},
			update: {
				phone: user.phone,
				codeHash: this.hash(userId, code),
				attempts: 0,
				expiresAt,
				lastSentAt: new Date(),
			},
		});

		const message = `Your DextaLearning verification code is ${code}. It expires in 10 minutes.`;
		if (channel === "sms") {
			await this.notifications.sendSms(user.phone, message);
		} else {
			await this.notifications.sendWhatsapp(user.phone, message);
		}

		return {
			status: "sent" as const,
			channel,
			expiresInSeconds: CODE_TTL_MS / 1000,
			resendInSeconds: RESEND_COOLDOWN_MS / 1000,
		};
	}

	/** Check a code; on success mark the phone verified and clear the challenge. */
	async verifyCode(userId: string, code: string) {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { phone: true, phoneVerified: true },
		});
		if (!user) throw new NotFoundException("User not found");
		if (user.phoneVerified) return { status: "verified" as const };

		const challenge = await this.prisma.phoneVerification.findUnique({
			where: { userId },
		});
		// No pending code, or it was issued for a number since changed.
		if (!challenge || challenge.phone !== user.phone) {
			throw new UnprocessableEntityException({
				code: "NO_ACTIVE_CODE",
				message: "Request a new verification code.",
			});
		}
		if (challenge.expiresAt.getTime() <= Date.now()) {
			await this.prisma.phoneVerification.delete({ where: { userId } });
			throw new UnprocessableEntityException({
				code: "CODE_EXPIRED",
				message: "That code has expired. Request a new one.",
			});
		}
		if (challenge.attempts >= MAX_ATTEMPTS) {
			throw new UnprocessableEntityException({
				code: "TOO_MANY_ATTEMPTS",
				message: "Too many incorrect tries. Request a new code.",
			});
		}

		const expected = Buffer.from(challenge.codeHash, "hex");
		const actual = Buffer.from(this.hash(userId, code), "hex");
		const matches =
			expected.length === actual.length && timingSafeEqual(expected, actual);
		if (!matches) {
			const updated = await this.prisma.phoneVerification.update({
				where: { userId },
				data: { attempts: { increment: 1 } },
			});
			throw new UnprocessableEntityException({
				code: "INVALID_CODE",
				message: "Incorrect code. Please check and try again.",
				details: {
					attemptsRemaining: Math.max(0, MAX_ATTEMPTS - updated.attempts),
				},
			});
		}

		await this.prisma.$transaction([
			this.prisma.user.update({
				where: { id: userId },
				data: { phoneVerified: true },
			}),
			this.prisma.phoneVerification.delete({ where: { userId } }),
		]);
		return { status: "verified" as const };
	}
}
