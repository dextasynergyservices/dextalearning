import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { TenantService } from "./tenant.service";

/**
 * Public academy directory (§2.1/§2.2). The web uses `GET /academies` to render
 * the academy switcher and `GET /academies/:slug` to theme an academy landing
 * page from its branding. No auth — academies are public.
 */
@ApiTags("academies")
@Controller("academies")
export class TenantController {
	constructor(private readonly tenants: TenantService) {}

	@Get()
	@ApiOperation({ summary: "List all academies (tenants)" })
	@ApiOkResponse({ description: "Every academy, in creation order." })
	list() {
		return this.tenants.list();
	}

	@Get(":slug")
	@ApiOperation({ summary: "Resolve one academy by slug (name + branding)" })
	@ApiOkResponse({ description: "The academy summary." })
	async get(@Param("slug") slug: string) {
		const academy = await this.tenants.getBySlug(slug);
		if (!academy) {
			throw new NotFoundException({
				message: "Academy not found",
				code: "ACADEMY_NOT_FOUND",
			});
		}
		return academy;
	}
}
