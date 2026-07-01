import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { InstructorOnboarding } from "@/components/onboarding/instructor-onboarding";
import { LearnerOnboarding } from "@/components/onboarding/learner-onboarding";
import { useSession } from "@/lib/auth-client";

export const Route = createFileRoute("/onboarding")({
	component: OnboardingPage,
});

/**
 * Role-aware onboarding (§8.1 / §8.1.1). Instructors get a studio-oriented track
 * (welcome + public profile); everyone else gets the learner preferences flow.
 */
function OnboardingPage() {
	const { data: session, isPending } = useSession();

	if (isPending) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<Loader2 className="size-6 animate-spin text-brand-primary" />
			</div>
		);
	}

	const role = (session?.user as { role?: string } | undefined)?.role;
	return role === "instructor" ? (
		<InstructorOnboarding />
	) : (
		<LearnerOnboarding />
	);
}
