import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../../prisma/prisma.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Liveness and database connectivity check" })
	async check(): Promise<{
		status: string;
		database: "up" | "down";
		timestamp: string;
	}> {
		let database: "up" | "down" = "up";
		try {
			await this.prisma.$queryRaw`SELECT 1`;
		} catch {
			database = "down";
		}

		return {
			status: "ok",
			database,
			timestamp: new Date().toISOString(),
		};
	}
}
