import { apiFetch } from "./api";

// Learning Coach (§4.10). The learner's latest weekly coaching digest, composed
// by the weekly sweep and delivered via notifications + email; this endpoint
// backs the dashboard card. Session-based.

export interface CoachDigest {
	headline: string;
	message: string;
	action: string | null;
	/** ISO date (YYYY-MM-DD) of the week the digest covers. */
	weekOf: string;
	createdAt: string;
}

export const getLatestCoachDigest = () =>
	apiFetch<CoachDigest | null>("/coach/latest");

export const coachKeys = {
	latest: ["coach", "latest"] as const,
};
