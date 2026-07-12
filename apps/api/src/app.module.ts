import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./auth/auth.module";
import { RateLimitModule } from "./common/rate-limit.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AssessmentsModule } from "./modules/assessments/assessments.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { ChatModule } from "./modules/chat/chat.module";
import { CoachModule } from "./modules/coach/coach.module";
import { CompletionModule } from "./modules/completion/completion.module";
import { ContentModule } from "./modules/content/content.module";
import { DropoffModule } from "./modules/dropoff/dropoff.module";
import { EngagementModule } from "./modules/engagement/engagement.module";
import { EnrollmentModule } from "./modules/enrollment/enrollment.module";
import { GroupingModule } from "./modules/grouping/grouping.module";
import { HealthModule } from "./modules/health/health.module";
import { KnowledgeModule } from "./modules/knowledge/knowledge.module";
import { LeaderboardModule } from "./modules/leaderboard/leaderboard.module";
import { MediaModule } from "./modules/media/media.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { OnboardingModule } from "./modules/onboarding/onboarding.module";
import { PacingModule } from "./modules/pacing/pacing.module";
import { PhoneVerificationModule } from "./modules/phone-verification/phone-verification.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { RemindersModule } from "./modules/reminders/reminders.module";
import { SimplifierModule } from "./modules/simplifier/simplifier.module";
import { TeachingModule } from "./modules/teaching/teaching.module";
import { TranslationModule } from "./modules/translation/translation.module";
import { TutorModule } from "./modules/tutor/tutor.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AiModule } from "./shared/ai/ai.module";
import { CacheModule } from "./shared/cache/cache.module";
import { EncodingModule } from "./shared/encoding/encoding.module";
import { NotificationsPortModule } from "./shared/notifications/notifications-port.module";
import { QueueModule } from "./shared/queue/queue.module";
import { StorageModule } from "./shared/storage/storage.module";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		EventEmitterModule.forRoot(),
		// In-process cron for the scheduled sweeps (reminders/coach/dropoff) —
		// replaces always-blocking BullMQ workers to spare serverless Redis.
		ScheduleModule.forRoot(),
		PrismaModule,
		// Loose-coupling foundation: storage/encoder/notification ports + queue bus.
		StorageModule,
		EncodingModule,
		QueueModule,
		AiModule,
		NotificationsPortModule,
		CacheModule,
		RateLimitModule,
		AuthModule,
		HealthModule,
		CatalogModule,
		ContentModule,
		MediaModule,
		AssessmentsModule,
		ProjectsModule,
		OnboardingModule,
		PhoneVerificationModule,
		GroupingModule,
		LeaderboardModule,
		ChatModule,
		TeachingModule,
		TutorModule,
		SimplifierModule,
		KnowledgeModule,
		CoachModule,
		DropoffModule,
		PacingModule,
		CompletionModule,
		EnrollmentModule,
		TranslationModule,
		EngagementModule,
		NotificationsModule,
		RemindersModule,
		AnalyticsModule,
	],
})
export class AppModule {}
