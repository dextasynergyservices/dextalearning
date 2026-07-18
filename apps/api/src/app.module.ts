import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./auth/auth.module";
import { RateLimitModule } from "./common/rate-limit.module";
import { AdminUsersModule } from "./modules/admin-users/admin-users.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AssessmentsModule } from "./modules/assessments/assessments.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { CertificatesModule } from "./modules/certificates/certificates.module";
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
import { PaymentsModule } from "./modules/payments/payments.module";
import { PhoneVerificationModule } from "./modules/phone-verification/phone-verification.module";
import { ProductAnalyticsModule } from "./modules/product-analytics/product-analytics.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { RemindersModule } from "./modules/reminders/reminders.module";
import { SimplifierModule } from "./modules/simplifier/simplifier.module";
import { TeachingModule } from "./modules/teaching/teaching.module";
import { TranslationModule } from "./modules/translation/translation.module";
import { TutorModule } from "./modules/tutor/tutor.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AiModule } from "./shared/ai/ai.module";
import { AnalyticsPortModule } from "./shared/analytics/analytics.module";
import { CacheModule } from "./shared/cache/cache.module";
import { EncodingModule } from "./shared/encoding/encoding.module";
import { NotificationsPortModule } from "./shared/notifications/notifications-port.module";
import { QueueModule } from "./shared/queue/queue.module";
import { PlatformSettingsModule } from "./shared/settings/platform-settings.module";
import { StorageModule } from "./shared/storage/storage.module";

// In-process cron for the scheduled sweeps (reminders/coach/dropoff/earn-back).
// On the free scale-to-zero tier the container is asleep most of the time, so
// these fire only when it happens to be awake anyway — set SCHEDULERS_ENABLED
// =false to switch them off entirely (and drive the sweeps from an external
// scheduler instead) when you don't want any background wake-compute.
const schedulerImports =
	process.env.SCHEDULERS_ENABLED === "false" ? [] : [ScheduleModule.forRoot()];

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		EventEmitterModule.forRoot(),
		...schedulerImports,
		PrismaModule,
		// Loose-coupling foundation: storage/encoder/notification ports + queue bus.
		StorageModule,
		EncodingModule,
		QueueModule,
		AiModule,
		NotificationsPortModule,
		CacheModule,
		PlatformSettingsModule,
		RateLimitModule,
		AuthModule,
		HealthModule,
		CatalogModule,
		CertificatesModule,
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
		PaymentsModule,
		TranslationModule,
		EngagementModule,
		NotificationsModule,
		RemindersModule,
		AdminUsersModule,
		AnalyticsPortModule,
		ProductAnalyticsModule,
		AnalyticsModule,
	],
})
export class AppModule {}
