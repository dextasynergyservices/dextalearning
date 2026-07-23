import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { InstructorApplicantOnboarding } from "@/components/onboarding/instructor-applicant-onboarding";
import { InstructorOnboarding } from "@/components/onboarding/instructor-onboarding";
import { LearnerOnboarding } from "@/components/onboarding/learner-onboarding";
import { takeInstructorIntent, useSession } from "@/lib/auth-client";
import { applyAsInstructor, getMyProfile } from "@/lib/content-api";

export const Route = createFileRoute("/onboarding")({
	component: OnboardingPage,
});

function Spinner() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<Loader2 className="size-6 animate-spin text-brand-primary" />
		</div>
	);
}

/**
 * Onboarding routed by INTENT, not by granted role (§8.1 / §8.1.1).
 *
 * Since instructor sign-up became an application, an applicant's role is
 * `learner` until an admin approves — so branching on the role alone sent every
 * applicant down the learner flow and made the instructor track unreachable.
 * A `pending` application gets its own track: it collects the profile the admin
 * actually reviews, then lets them get on with learning while they wait.
 *
 * Google sign-up needs one extra beat. Better Auth's social handler creates the
 * account without ever seeing the "Join as" toggle, so the choice is remembered
 * locally and redeemed HERE — the first authenticated page a new OAuth user
 * lands on. Until that call settles we show a spinner rather than flashing the
 * wrong flow at someone who asked to teach.
 */
function OnboardingPage() {
	const { data: session, isPending } = useSession();
	const [redeeming, setRedeeming] = useState(() => takeInstructorIntent());

	useEffect(() => {
		if (!redeeming) return;
		let cancelled = false;
		applyAsInstructor()
			.catch(() => {
				// Best-effort: they can still apply from their profile later, and we
				// must not strand them on a spinner.
			})
			.finally(() => {
				if (!cancelled) setRedeeming(false);
			});
		return () => {
			cancelled = true;
		};
	}, [redeeming]);

	// After redeeming, the session still carries the pre-application snapshot, so
	// read the application state from the server instead of trusting it.
	const { data: profile, isPending: profilePending } = useQuery({
		queryKey: ["my-profile"],
		queryFn: getMyProfile,
		enabled: Boolean(session) && !redeeming,
		staleTime: 0,
	});

	if (isPending || redeeming || (session && profilePending)) return <Spinner />;

	const sessionUser = session?.user as
		| { role?: string; instructorStatus?: string | null }
		| undefined;
	const status = profile?.instructorStatus ?? sessionUser?.instructorStatus;
	const role = profile?.role ?? sessionUser?.role;

	if (status === "pending") return <InstructorApplicantOnboarding />;
	// Already-approved instructors (and admins) keep the studio-oriented track.
	return role === "instructor" ? (
		<InstructorOnboarding />
	) : (
		<LearnerOnboarding />
	);
}
