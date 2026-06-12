import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
	const port = Number(process.env.PORT ?? 3000);

	app.setGlobalPrefix("api/v1");
	app.enableCors({
		origin: frontendUrl.split(",").map((origin) => origin.trim()),
		credentials: true,
	});
	// biome-ignore lint/correctness/useHookAtTopLevel: Nest application setup method, not a React hook.
	app.useGlobalPipes(
		new ValidationPipe({
			transform: true,
			whitelist: true,
			forbidNonWhitelisted: true,
		}),
	);

	const swaggerConfig = new DocumentBuilder()
		.setTitle("DextaLearning API")
		.setDescription("Behavior-driven learning operating system API")
		.setVersion("1.0")
		.build();
	const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
	SwaggerModule.setup("api/docs", app, swaggerDocument);

	await app.listen(port, "0.0.0.0");
}
bootstrap();
