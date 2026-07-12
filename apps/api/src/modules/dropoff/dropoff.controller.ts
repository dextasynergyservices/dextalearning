import { Controller, Post, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { SessionGuard } from "../../auth/guards/session.guard";
import { DropoffService } from "./dropoff.service";

/**
 * Drop-off predictor (§4.10). Flags surface inside the Teaching + Facilitator
 * views (merged via the query service); this endpoint runs the daily sweep on
 * demand for ops / verification. Admin only.
 */
@ApiTags("dropoff")
@Controller("admin/dropoff")
export class DropoffController {
	constructor(private readonly dropoff: DropoffService) {}

	@Post("run")
	@UseGuards(SessionGuard, RolesGuard)
	@Roles("admin")
	@ApiOperation({ summary: "Run the drop-off sweep now (admin)" })
	run() {
		return this.dropoff.sweep();
	}
}
