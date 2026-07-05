import {
	BadRequestException,
	Body,
	ConflictException,
	Controller,
	HttpCode,
	Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";
import { auth } from "./auth.config";
import { RegisterDto } from "./dto/register.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Custom registration endpoint: validates all fields server-side (including
	 * confirm-password match) and delegates user creation to Better Auth, passing
	 * the additional profile fields. Login, Google OAuth, OTP and magic-link flows
	 * are served by the mounted Better Auth handler at /api/auth/*.
	 */
	@Post("register")
	@HttpCode(201)
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
					// Clamped to learner|instructor by the Better Auth create hook.
					role: dto.role ?? "learner",
				},
			});

			return {
				userId: result.user.id,
				email: result.user.email,
				emailVerified: result.user.emailVerified,
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
}
