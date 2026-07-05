import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { createCourse } from "../integration/support/factories";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("CatalogController (e2e)", () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;

	beforeAll(async () => {
		({ app, prisma } = await buildE2eApp());
	});

	beforeEach(async () => {
		await resetDatabase(prisma);
	});

	afterAll(async () => {
		await app.close();
	});

	it("GET /catalog/featured is public — no auth needed", async () => {
		const res = await request(app.getHttpServer())
			.get("/api/v1/catalog/featured")
			.expect(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data.courses).toEqual([]);
	});

	it("GET /catalog/recommended works logged-out (OptionalSessionGuard doesn't reject)", async () => {
		const res = await request(app.getHttpServer())
			.get("/api/v1/catalog/recommended")
			.expect(200);
		expect(res.body.data.personalized.courses).toBe(false);
	});

	it("GET /catalog/courses/:slug 404s for a non-existent course", async () => {
		const res = await request(app.getHttpServer())
			.get("/api/v1/catalog/courses/does-not-exist")
			.expect(404);
		expect(res.body.success).toBe(false);
	});

	it("GET /catalog/courses/:slug returns a real published course", async () => {
		const course = await createCourse(prisma, {
			status: "published",
			slug: "real-course",
		});
		const res = await request(app.getHttpServer())
			.get(`/api/v1/catalog/courses/${course.slug}`)
			.expect(200);
		expect(res.body.data.id).toBe(course.id);
	});

	describe("GET /catalog/feature-requests — admin-only (RolesGuard)", () => {
		it("401s without a session", async () => {
			await request(app.getHttpServer())
				.get("/api/v1/catalog/feature-requests")
				.expect(401);
		});

		it("403s for an authenticated non-admin", async () => {
			const { agent } = await registerAndLogin(app, prisma, {
				role: "learner",
			});
			const res = await agent
				.get("/api/v1/catalog/feature-requests")
				.expect(403);
			expect(res.body.success).toBe(false);
		});

		it("200s for an admin", async () => {
			// RegisterDto only accepts learner|instructor self-service roles, so
			// promote after registering (mirrors how admins are actually granted
			// out-of-band, never self-assigned).
			const { agent, userId } = await registerAndLogin(app, prisma, {
				role: "learner",
			});
			await prisma.user.update({
				where: { id: userId },
				data: { role: "admin" },
			});
			await agent.get("/api/v1/catalog/feature-requests").expect(200);
		});
	});
});
