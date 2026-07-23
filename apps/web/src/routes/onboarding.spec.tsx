// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderRoute } from "@/test/render-route";

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

// The onboarding flows are heavy multi-step wizards tested separately —
// stub them so this spec isolates the route's own role-based branching.
vi.mock("@/components/onboarding/instructor-onboarding", () => ({
	InstructorOnboarding: () => <div>Instructor onboarding flow</div>,
}));
vi.mock("@/components/onboarding/learner-onboarding", () => ({
	LearnerOnboarding: () => <div>Learner onboarding flow</div>,
}));
vi.mock("@/components/onboarding/instructor-applicant-onboarding", () => ({
	InstructorApplicantOnboarding: () => <div>Applicant onboarding flow</div>,
}));

describe("OnboardingPage", () => {
	it("renders the instructor onboarding flow for an instructor", async () => {
		useSessionMock.mockReturnValue({
			data: { user: { role: "instructor" } },
			isPending: false,
		});
		renderRoute("/onboarding");
		expect(
			await screen.findByText("Instructor onboarding flow"),
		).toBeInTheDocument();
	});

	it("renders the learner onboarding flow for a learner", async () => {
		useSessionMock.mockReturnValue({
			data: { user: { role: "learner" } },
			isPending: false,
		});
		renderRoute("/onboarding");
		expect(
			await screen.findByText("Learner onboarding flow"),
		).toBeInTheDocument();
	});

	it("renders the learner onboarding flow by default when there's no role yet", async () => {
		useSessionMock.mockReturnValue({ data: null, isPending: false });
		renderRoute("/onboarding");
		expect(
			await screen.findByText("Learner onboarding flow"),
		).toBeInTheDocument();
	});

	/**
	 * A pending applicant's role is `learner` until an admin approves (§8.1.1), so
	 * branching on the role alone silently sent every instructor applicant down
	 * the learner flow. Route on INTENT instead — this is the regression guard.
	 */
	it("renders the applicant flow for a pending instructor, not the learner flow", async () => {
		useSessionMock.mockReturnValue({
			data: { user: { role: "learner", instructorStatus: "pending" } },
			isPending: false,
		});
		renderRoute("/onboarding");
		expect(
			await screen.findByText("Applicant onboarding flow"),
		).toBeInTheDocument();
		expect(
			screen.queryByText("Learner onboarding flow"),
		).not.toBeInTheDocument();
	});

	it("keeps an approved instructor on the studio track", async () => {
		useSessionMock.mockReturnValue({
			data: { user: { role: "instructor", instructorStatus: "approved" } },
			isPending: false,
		});
		renderRoute("/onboarding");
		expect(
			await screen.findByText("Instructor onboarding flow"),
		).toBeInTheDocument();
	});
});
