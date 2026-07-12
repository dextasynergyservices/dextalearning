import { apiFetch } from "./api";

// Adaptive Pacing (§4.10). The learner's current rhythm signal, fetched by the
// lesson player when a lesson completes. Session-based.

export type PacingState = "rushing" | "ahead" | "on_track" | "behind";

export interface PacingSignal {
	state: PacingState;
	lessonsThisWeek: number;
	targetPerWeek: number | null;
}

export const getMyPacing = () => apiFetch<PacingSignal>("/pacing/me");

export const pacingKeys = {
	me: ["pacing", "me"] as const,
};
