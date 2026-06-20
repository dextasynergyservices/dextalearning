import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { AuthModule } from "./auth/auth.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { ContentModule } from "./modules/content/content.module";
import { HealthModule } from "./modules/health/health.module";
import { MediaModule } from "./modules/media/media.module";
import { PrismaModule } from "./prisma/prisma.module";
import { EncodingModule } from "./shared/encoding/encoding.module";
import { QueueModule } from "./shared/queue/queue.module";
import { StorageModule } from "./shared/storage/storage.module";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		EventEmitterModule.forRoot(),
		PrismaModule,
		// Loose-coupling foundation (§6.4): storage/encoder ports + queue bus.
		StorageModule,
		EncodingModule,
		QueueModule,
		AuthModule,
		HealthModule,
		CatalogModule,
		ContentModule,
		MediaModule,
	],
})
export class AppModule {}
