import { Module } from "@nestjs/common";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

/** Onboarding bounded context — persists learner prefs + instructor profile (§8.1). */
@Module({
	controllers: [OnboardingController],
	providers: [OnboardingService],
})
export class OnboardingModule {}
