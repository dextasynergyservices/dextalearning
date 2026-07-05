import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildE2eApp } from "./support/bootstrap";

describe("HealthController (e2e)", () => {
	let app: NestExpressApplication;

	beforeAll(async () => {
		({ app } = await buildE2eApp());
	});

	afterAll(async () => {
		await app.close();
	});

	it("/api/v1/health (GET)", () => {
		return request(app.getHttpServer())
			.get("/api/v1/health")
			.expect(200)
			.expect(({ body }) => {
				expect(body.success).toBe(true);
				expect(body.data.status).toBe("ok");
				expect(body.data.database).toBe("up");
			});
	});
});
