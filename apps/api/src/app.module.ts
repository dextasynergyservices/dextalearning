import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { AuthModule } from "./auth/auth.module";
import { AssessmentsModule } from "./modules/assessments/assessments.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { CompletionModule } from "./modules/completion/completion.module";
import { ContentModule } from "./modules/content/content.module";
import { EnrollmentModule } from "./modules/enrollment/enrollment.module";
import { HealthModule } from "./modules/health/health.module";
import { MediaModule } from "./modules/media/media.module";
import { OnboardingModule } from "./modules/onboarding/onboarding.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { TranslationModule } from "./modules/translation/translation.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AiModule } from "./shared/ai/ai.module";
import { EncodingModule } from "./shared/encoding/encoding.module";
import { QueueModule } from "./shared/queue/queue.module";
import { StorageModule } from "./shared/storage/storage.module";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		EventEmitterModule.forRoot(),
		PrismaModule,
		// Loose-coupling foundation: storage/encoder ports + queue bus.
		StorageModule,
		EncodingModule,
		QueueModule,
		AiModule,
		AuthModule,
		HealthModule,
		CatalogModule,
		ContentModule,
		MediaModule,
		AssessmentsModule,
		ProjectsModule,
		OnboardingModule,
		CompletionModule,
		EnrollmentModule,
		TranslationModule,
	],
})
export class AppModule {}
