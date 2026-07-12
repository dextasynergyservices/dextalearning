/**
 * Adaptive pacing model (§4.10). A pure, explainable heuristic — framework-free
 * (§6.4 rule 4) — that reads a learner's rhythm from this week's activity and
 * their declared weekly goal, so the lesson player can nudge pace right after a
 * completion. Deterministic and cheap; no AI call. State is localized client-side.
 */
export type PacingState = "rushing" | "ahead" | "on_track" | "behind";

/** Weekly-lesson target inferred from the onboarding weekly-hours bucket. */
export const WEEKLY_HOURS_TARGET: Record<string, number> = {
	low: 3,
	medium: 7,
	high: 12,
	max: 18,
};

export interface PacingInput {
	lessonsThisWeek: number;
	/** Target lessons/week from the learner's goal, or null if none set. */
	targetPerWeek: number | null;
	quizzesPassed: number;
	quizzesTotal: number;
}

export interface PacingSignal {
	state: PacingState;
	lessonsThisWeek: number;
	targetPerWeek: number | null;
}

export function computePacing(input: PacingInput): PacingSignal {
	const { lessonsThisWeek, targetPerWeek, quizzesPassed, quizzesTotal } = input;
	const accuracy = quizzesTotal > 0 ? quizzesPassed / quizzesTotal : null;

	// Rushing: a real volume of work but low retention — speed is hurting depth
	// (§3.1). Needs enough quizzes to be a signal, not noise.
	const busyThreshold = Math.max(3, targetPerWeek ?? 3);
	if (
		quizzesTotal >= 2 &&
		accuracy !== null &&
		accuracy < 0.5 &&
		lessonsThisWeek >= busyThreshold
	) {
		return { state: "rushing", lessonsThisWeek, targetPerWeek };
	}

	if (targetPerWeek !== null) {
		if (lessonsThisWeek >= targetPerWeek) {
			return { state: "ahead", lessonsThisWeek, targetPerWeek };
		}
		// Well under half the weekly goal → gently behind.
		if (lessonsThisWeek * 2 < targetPerWeek) {
			return { state: "behind", lessonsThisWeek, targetPerWeek };
		}
		return { state: "on_track", lessonsThisWeek, targetPerWeek };
	}

	// No declared goal: celebrate a strong week, otherwise steady.
	if (lessonsThisWeek >= 5) {
		return { state: "ahead", lessonsThisWeek, targetPerWeek };
	}
	return { state: "on_track", lessonsThisWeek, targetPerWeek };
}
