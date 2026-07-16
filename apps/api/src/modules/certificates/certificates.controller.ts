import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { CertificatesService } from "./certificates.service";

/**
 * Certificates HTTP surface (§5.8). Verification is PUBLIC (the QR/URL anyone
 * can check); listing + downloading are owner-scoped behind the session guard.
 */
@ApiTags("certificates")
@Controller("certificates")
export class CertificatesController {
	constructor(private readonly certificates: CertificatesService) {}

	@Get("verify/:token")
	@ApiOperation({ summary: "Public certificate verification (QR / URL)" })
	verify(@Param("token") token: string) {
		return this.certificates.verify(token);
	}

	@Get("mine")
	@ApiCookieAuth("better-auth.session_token")
	@ApiOperation({ summary: "The learner's own certificates" })
	@UseGuards(SessionGuard)
	listMine(@CurrentUser() user: AuthenticatedUser) {
		return this.certificates.listMine(user.id);
	}

	@Get(":id/download")
	@ApiCookieAuth("better-auth.session_token")
	@ApiOperation({
		summary: "Signed (2h) download URL for an owned certificate",
	})
	@UseGuards(SessionGuard)
	async download(
		@Param("id") id: string,
		@CurrentUser() user: AuthenticatedUser,
	) {
		return { url: await this.certificates.downloadUrl(user.id, id) };
	}
}
