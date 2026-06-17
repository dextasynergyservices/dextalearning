import {
	BadRequestException,
	Body,
	Controller,
	HttpCode,
	Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { auth } from "./auth.config";
import { RegisterDto } from "./dto/register.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
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
			throw new BadRequestException(message);
		}
	}
}
