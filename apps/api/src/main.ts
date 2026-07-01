import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { toNodeHandler } from "better-auth/node";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { auth } from "./auth/auth.config";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";

async function bootstrap() {
	// Disable Nest's body parser so Better Auth can read the raw request.
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		bodyParser: false,
	});
	const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
	const port = Number(process.env.PORT ?? 3000);

	// Behind Railway's TLS-terminating proxy: trust X-Forwarded-* so the app
	// treats requests as HTTPS (correct protocol + Secure-cookie handling).
	app.set("trust proxy", 1);

	app.setGlobalPrefix("api/v1");
	app.enableCors({
		origin: frontendUrl.split(",").map((origin) => origin.trim()),
		credentials: true,
	});

	// Better Auth handler (login, OAuth, OTP, magic link) — must run on the raw
	// request, before the JSON body parser is applied to the rest of the app.
	const authHandler = toNodeHandler(auth);
	app.use((req: Request, res: Response, next: NextFunction) => {
		if (req.originalUrl.startsWith("/api/auth")) {
			void authHandler(req, res);
			return;
		}
		next();
	});
	// Re-enable body parsing for the rest of the app (Nest's own parser, applied
	// after the Better Auth middleware so /api/auth keeps its raw body).
	// biome-ignore lint/correctness/useHookAtTopLevel: Nest application setup method, not a React hook.
	app.useBodyParser("json");
	// biome-ignore lint/correctness/useHookAtTopLevel: Nest application setup method, not a React hook.
	app.useBodyParser("urlencoded");

	// biome-ignore lint/correctness/useHookAtTopLevel: Nest application setup method, not a React hook.
	app.useGlobalPipes(
		new ValidationPipe({
			transform: true,
			whitelist: true,
			forbidNonWhitelisted: true,
		}),
	);
	// biome-ignore lint/correctness/useHookAtTopLevel: Nest application setup method, not a React hook.
	app.useGlobalFilters(new AllExceptionsFilter());
	// biome-ignore lint/correctness/useHookAtTopLevel: Nest application setup method, not a React hook.
	app.useGlobalInterceptors(new ResponseInterceptor());

	const swaggerConfig = new DocumentBuilder()
		.setTitle("DextaLearning API")
		.setDescription(
			[
				"Behaviour-driven learning operating system API.",
				"",
				"- **Auth** — session cookies issued by Better Auth at `/api/auth/*` (sign-in, OAuth, OTP). Protected endpoints read that cookie, so call them with credentials included.",
				"- **Envelope** — success responses are `{ success: true, data }`; errors are `{ success: false, error: { code, message, details?, requestId } }`.",
				"- **Roles** — `learner`, `instructor`, `facilitator`, `admin`. Admin satisfies every role gate.",
			].join("\n"),
		)
		.setVersion("1.0")
		.addCookieAuth("better-auth.session_token", {
			type: "apiKey",
			in: "cookie",
			description: "Better Auth session cookie set after sign-in.",
		})
		.addTag("catalog", "Public browse of published courses & curricula")
		.addTag("authoring", "Instructor/Admin course → module → lesson management")
		.addTag("media", "Lesson media uploads, encoding & protected playback")
		.addTag("assessments", "Instructor/Admin assessment + question authoring")
		.addTag("attempts", "Learner assessment attempts — server timer + grading")
		.addTag(
			"assessment-reports",
			"Instructor/Admin anti-cheat reporting + review",
		)
		.addTag("projects", "Instructor/Admin project authoring + grading")
		.addTag("project-submissions", "Learner project submission + peer review")
		.addTag("completion", "Course/path/cohort progress + completion gates")
		.addTag("auth", "Registration (Better Auth serves sign-in/OAuth/OTP)")
		.addTag("health", "Liveness probe")
		.build();
	const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
	// Mounted under the API prefix so the docs live alongside the endpoints:
	// UI at /api/v1/docs, spec at /api/v1/docs-json.
	SwaggerModule.setup("api/v1/docs", app, swaggerDocument);

	await app.listen(port, "0.0.0.0");
}
bootstrap();
