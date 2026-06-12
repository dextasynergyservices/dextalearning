import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types";
import { AppModule } from "./../src/app.module";

describe("AppController (e2e)", () => {
	let app: INestApplication<App>;

	beforeEach(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		app.setGlobalPrefix("api/v1");
		await app.init();
	});

	it("/api/v1/health (GET)", () => {
		return request(app.getHttpServer())
			.get("/api/v1/health")
			.expect(200)
			.expect(({ body }) => {
				expect(body.success).toBe(true);
				expect(body.service).toBe("dextalearning-api");
			});
	});

	afterEach(async () => {
		await app.close();
	});
});
