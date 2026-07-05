// biome-ignore-all lint/correctness/useHookAtTopLevel: NestJS testing-module builder + app setup methods (useClass/useValue/useGlobalPipes/etc.) match the `use*` naming pattern but are not React hooks.
import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { toNodeHandler } from "better-auth/node";
import type { Queue } from "bullmq";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "../../../src/app.module";
import { auth } from "../../../src/auth/auth.config";
import { AllExceptionsFilter } from "../../../src/common/filters/all-exceptions.filter";
import { ResponseInterceptor } from "../../../src/common/interceptors/response.interceptor";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { AI_PORT } from "../../../src/shared/ai/ai.port";
import { MEDIA_ENCODER_PORT } from "../../../src/shared/encoding/media-encoder.port";
import {
	AUDIO_QUEUE,
	CAPTION_QUEUE,
	VIDEO_QUEUE,
} from "../../../src/shared/queue/queue.constants";
import { STORAGE_PORT } from "../../../src/shared/storage/storage.port";
import { FakeAiAdapter } from "../../integration/support/fakes/fake-ai.adapter";
import { FakeMediaEncoderAdapter } from "../../integration/support/fakes/fake-media-encoder.adapter";
import { FakeQueue } from "../../integration/support/fakes/fake-queue";
import { FakeStorageAdapter } from "../../integration/support/fakes/fake-storage.adapter";

/**
 * Boots the full Nest app exactly like `main.ts` (§5.10 envelope, Better Auth
 * raw-body middleware, ValidationPipe, exception filter, `/api/v1` prefix),
 * with the I/O ports swapped for the same fakes Phase C already built — no
 * real R2/Gemini/Redis needed. Returns the real DI `PrismaService` instance so
 * tests can seed/inspect via the same connection the app itself uses.
 */
export async function buildE2eApp(): Promise<{
	app: NestExpressApplication;
	prisma: PrismaService;
}> {
	const moduleFixture = await Test.createTestingModule({
		imports: [AppModule],
	})
		.overrideProvider(STORAGE_PORT)
		.useClass(FakeStorageAdapter)
		.overrideProvider(MEDIA_ENCODER_PORT)
		.useClass(FakeMediaEncoderAdapter)
		.overrideProvider(AI_PORT)
		.useClass(FakeAiAdapter)
		.overrideProvider(VIDEO_QUEUE)
		.useValue(new FakeQueue() as unknown as Queue)
		.overrideProvider(AUDIO_QUEUE)
		.useValue(new FakeQueue() as unknown as Queue)
		.overrideProvider(CAPTION_QUEUE)
		.useValue(new FakeQueue() as unknown as Queue)
		.compile();

	const app = moduleFixture.createNestApplication<NestExpressApplication>({
		bodyParser: false,
	});

	const authHandler = toNodeHandler(auth);
	app.use((req: Request, res: Response, next: NextFunction) => {
		if (req.originalUrl.startsWith("/api/auth")) {
			void authHandler(req, res);
			return;
		}
		next();
	});
	app.useBodyParser("json");
	app.useBodyParser("urlencoded");

	app.useGlobalPipes(
		new ValidationPipe({
			transform: true,
			whitelist: true,
			forbidNonWhitelisted: true,
		}),
	);
	app.useGlobalFilters(new AllExceptionsFilter());
	app.useGlobalInterceptors(new ResponseInterceptor());
	app.setGlobalPrefix("api/v1");

	await app.init();

	const prisma = moduleFixture.get(PrismaService);
	return { app, prisma };
}
