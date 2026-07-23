import {
	BadRequestException,
	Body,
	ConflictException,
	Controller,
	HttpCode,
	Post,
	UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { UserThrottlerGuard } from "../common/guards/user-throttler.guard";
import { TurnstileGuard } from "../common/turnstile";
import { NotificationsService } from "../modules/notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { auth } from "./auth.config";
import { CurrentUser } from "./decorators/current-user.decorator";
import { RegisterDto } from "./dto/register.dto";
import { SessionGuard } from "./guards/session.guard";
import type { AuthenticatedUser } from "./types";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
	constructor(
		private readonly prisma: PrismaService,
		private readonly notifications: NotificationsService,
	) {}

	/**
	 * Tell every admin that someone applied to be an instructor (§5). Best-effort:
	 * a notification failure must never fail the registration itself — the
	 * application is already recorded as `instructorStatus = "pending"` and the
	 * admin queue reads from that, so nothing is lost if this throws.
	 */
	private async notifyAdminsOfInstructorApplication(applicant: {
		id: string;
		email: string;
		name: string;
	}): Promise<void> {
		try {
			const admins = await this.prisma.user.findMany({
				where: { role: "admin", suspendedAt: null },
				select: { id: true, email: true },
			});
			await Promise.all(
				admins.map((admin) =>
					this.notifications.notify(admin.id, {
						type: "instructor_application",
						dataJson: {
							applicantId: applicant.id,
							name: applicant.name,
							email: applicant.email,
						},
						inApp: true,
						email: {
							to: admin.email,
							subject: `Instructor application — ${applicant.name}`,
							html: `<p><strong>${applicant.name}</strong> (${applicant.email}) applied to teach on DextaLearning.</p><p>They cannot author anything until you approve them. Review it in Admin → Users → Instructor applications.</p>`,
						},
						push: {
							title: "New instructor application",
							body: `${applicant.name} applied to teach.`,
							url: "/admin/users",
							tag: "instructor-application",
						},
					}),
				),
			);
		} catch {
			// Swallowed on purpose — see the doc comment above.
		}
	}

	/**
	 * Custom registration endpoint: validates all fields server-side (including
	 * confirm-password match) and delegates user creation to Better Auth, passing
	 * the additional profile fields. Login, Google OAuth, OTP and magic-link flows
	 * are served by the mounted Better Auth handler at /api/auth/*.
	 */
	// §5.9: registration is a Nest route, so its bot-check (Turnstile) and its
	// strict per-IP limit (5/60s, matching the Better Auth auth routes) live
	// here rather than in Better Auth's own rate limiter.
	@Post("register")
	@HttpCode(201)
	@UseGuards(TurnstileGuard, UserThrottlerGuard)
	@Throttle({ global: { ttl: 60_000, limit: 5 } })
	@ApiOperation({ summary: "Register with email + password" })
	async register(@Body() dto: RegisterDto) {
		// Better Auth's signUpEmail has built-in enumeration protection: it
		// returns a synthetic "success" response for an already-registered email
		// instead of throwing, so it never reaches the USER_ALREADY_EXISTS catch
		// below. Check directly so the intended "sign in instead" UX still fires.
		const existing = await this.prisma.user.findUnique({
			where: { email: dto.email },
			select: { id: true },
		});
		if (existing) {
			throw new ConflictException({
				message:
					"An account with this email already exists. Please sign in instead.",
				code: "EMAIL_EXISTS",
			});
		}
		try {
			const result = await auth.api.signUpEmail({
				body: {
					email: dto.email,
					password: dto.password,
					name: `${dto.firstName} ${dto.lastName}`.trim(),
					firstName: dto.firstName,
					lastName: dto.lastName,
					otherNames: dto.otherNames,
					phone: dto.phone,
					// Requesting `instructor` records a PENDING application on a
					// learner account — the Better Auth create hook never grants it.
					role: dto.role ?? "learner",
				},
			});

			// Admins decide; tell them there's something waiting.
			const appliedAsInstructor = dto.role === "instructor";
			if (appliedAsInstructor) {
				await this.notifyAdminsOfInstructorApplication({
					id: result.user.id,
					email: result.user.email,
					name: `${dto.firstName} ${dto.lastName}`.trim(),
				});
			}

			return {
				userId: result.user.id,
				email: result.user.email,
				emailVerified: result.user.emailVerified,
				/** True when an instructor application is awaiting admin approval. */
				instructorPending: appliedAsInstructor,
			};
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Registration failed";
			// Better Auth signals a duplicate with USER_ALREADY_EXISTS — surface a
			// clear 409 + stable code so the UI can nudge the user to sign in.
			const code = (error as { body?: { code?: string } }).body?.code;
			if (
				code === "USER_ALREADY_EXISTS" ||
				/already (exists|registered)|existing account/i.test(message)
			) {
				throw new ConflictException({
					message:
						"An account with this email already exists. Please sign in instead.",
					code: "EMAIL_EXISTS",
				});
			}
			throw new BadRequestException(message);
		}
	}

	/**
	 * File an instructor application for the signed-in user (§8.1.1).
	 *
	 * Exists because Google sign-up can't carry the "Join as: Instructor" choice
	 * through the OAuth round-trip: the account is created by Better Auth's social
	 * handler, which knows nothing about the toggle. The web app remembers the
	 * intent locally and redeems it here once the session exists.
	 *
	 * Deliberately narrow, so it can never become an escalation path: it only ever
	 * moves a `learner` with NO existing application to `pending`. It cannot grant
	 * a role, cannot revive a rejected application, and is idempotent.
	 */
	@Post("instructor-application")
	@HttpCode(200)
	@UseGuards(SessionGuard, UserThrottlerGuard)
	@Throttle({ global: { ttl: 60_000, limit: 5 } })
	@ApiCookieAuth("better-auth.session_token")
	@ApiOperation({
		summary: "Apply to become an instructor (used after Google sign-up)",
	})
	async applyAsInstructor(@CurrentUser() user: AuthenticatedUser) {
		const current = await this.prisma.user.findUnique({
			where: { id: user.id },
			select: {
				role: true,
				instructorStatus: true,
				email: true,
				firstName: true,
				lastName: true,
			},
		});
		if (!current) throw new BadRequestException("Account not found");

		// Already an instructor, or already decided/awaiting — nothing to do. Not an
		// error: the client redeems a stored flag and may retry.
		if (current.role !== "learner" || current.instructorStatus !== null) {
			return { instructorPending: current.instructorStatus === "pending" };
		}

		await this.prisma.user.update({
			where: { id: user.id },
			data: { instructorStatus: "pending" },
		});
		await this.notifyAdminsOfInstructorApplication({
			id: user.id,
			email: current.email,
			name: `${current.firstName} ${current.lastName}`.trim(),
		});
		return { instructorPending: true };
	}
}
