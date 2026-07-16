/**
 * Pure assessment-attempt math (§4.4, §4.6.1, §4.6.3/4, §6.4 "pure
 * calculators" — no Prisma, no I/O). Extracted from attempts.service.ts:
 * grading/scoring, fast-answer detection, and anti-cheat severity/integrity/
 * auto-submit rules — all deterministic given their inputs.
 */

export interface CorrectnessQuestion {
	type: string | null;
	correctAnswer: string | null;
}

/** Deterministic exact-match grading (AI semantic grading for short-answer
 *  misses happens separately, upstream of this — this is only the free pass). */
export function isAnswerCorrect(
	question: CorrectnessQuestion | undefined,
	answer: string | undefined,
): boolean {
	if (!question || answer == null) return false;
	const given = String(answer).trim();
	const correct = (question.correctAnswer ?? "").trim();
	if (correct.length === 0) return false;
	if (question.type === "short_answer") {
		return given.toLowerCase() === correct.toLowerCase();
	}
	return given === correct;
}

export interface ScoredQuestion {
	points: number;
	correct: boolean;
}

export interface ScoreResult {
	earned: number;
	total: number;
	score: number;
}

/** Percent score (2dp), 0 if the assessment has no scoreable points. */
export function calculateScore(questions: ScoredQuestion[]): ScoreResult {
	let earned = 0;
	let total = 0;
	for (const q of questions) {
		total += q.points;
		if (q.correct) earned += q.points;
	}
	const score = total > 0 ? Math.round((earned / total) * 10_000) / 100 : 0;
	return { earned, total, score };
}

export function isPassed(score: number, passMark: number): boolean {
	return score >= passMark;
}

export interface FastAnswerInput {
	thresholdSeconds: number;
	startedAt: Date | string;
	/** questionId -> ISO timestamp the answer was recorded */
	answeredAt: Record<string, string>;
}

export interface FastAnswerFlag {
	questionId: string;
	seconds: number;
}

/** Flags answers given faster than `thresholdSeconds` after the prior event
 *  (or attempt start), in chronological order — a signal of pre-known answers. */
export function detectFastAnswers(input: FastAnswerInput): FastAnswerFlag[] {
	if (input.thresholdSeconds <= 0) return [];
	const sorted = Object.entries(input.answeredAt)
		.map(([questionId, iso]) => ({ questionId, t: new Date(iso).getTime() }))
		.sort((a, b) => a.t - b.t);
	const flags: FastAnswerFlag[] = [];
	let prev = new Date(input.startedAt).getTime();
	for (const entry of sorted) {
		const gap = (entry.t - prev) / 1000;
		if (gap >= 0 && gap < input.thresholdSeconds) {
			flags.push({
				questionId: entry.questionId,
				seconds: Math.round(gap * 100) / 100,
			});
		}
		prev = entry.t;
	}
	return flags;
}

export type AntiCheatSeverity = "info" | "low" | "medium" | "high";

/**
 * `info` is recorded evidence that is NOT an accusation: it must never cost the
 * learner a point. The camera monitor failing to load is a fact about our
 * software, not their conduct.
 */
export const SEVERITY_WEIGHT: Record<string, number> = {
	info: 0,
	low: 2,
	medium: 5,
	high: 10,
};

/** Events that describe the monitoring itself rather than the learner (§4.6.2). */
export const SYSTEM_EVENT_TYPES = new Set(["camera_monitor_unavailable"]);

export const DEFAULT_SEVERITY: Record<string, AntiCheatSeverity> = {
	tab_switch: "medium",
	focus_loss: "low",
	copy_attempt: "medium",
	paste_attempt: "medium",
	right_click: "low",
	keyboard_shortcut: "low",
	fullscreen_exit: "high",
	camera_face_missing: "medium",
	camera_multiple_faces: "high",
	camera_monitor_unavailable: "info",
	fast_answer: "low",
	viewport_change: "low",
	devtools_open: "high",
};

/**
 * Client-reported severity wins; otherwise fall back to the event's default,
 * and "medium" for an unrecognised event type.
 *
 * With two exceptions the client does NOT get to decide, because severity comes
 * from the party being measured:
 *  - a system event is always `info` — it describes our software, not them;
 *  - `info` is never client-grantable on anything else, or a cheat could label
 *    a real tab-switch weightless and zero out its own penalty.
 */
export function resolveSeverity(
	eventType: string,
	explicit?: string,
): AntiCheatSeverity {
	if (SYSTEM_EVENT_TYPES.has(eventType)) return "info";
	const claimed = explicit === "info" ? undefined : explicit;
	return (
		(claimed as AntiCheatSeverity | undefined) ??
		DEFAULT_SEVERITY[eventType] ??
		"medium"
	);
}

export interface IntegrityResult {
	integrityScore: number;
	flagCount: number;
	/**
	 * False when the camera monitor never ran. An integrity score only means
	 * something if something was actually watching — see `calculateIntegrity`.
	 */
	cameraMonitorFailed: boolean;
}

/**
 * 100 minus the weighted penalty of every logged flag, floored at 0.
 *
 * **A clean score is not the same as a clean attempt.** With no logs this
 * returns 100 — which is correct for a monitored learner who behaved, and a lie
 * for an attempt where the camera monitor never loaded and nobody was watching.
 * The two are indistinguishable by score alone, so the absence of monitoring is
 * reported separately (`cameraMonitorFailed`) and callers must surface it
 * instead of the number. Penalising it would punish a learner for our CDN, and
 * scoring it 100 would hand a cheat a clean bill of health for blocking one
 * network request.
 *
 * System events (`info`) are evidence, not accusations: weight 0, and excluded
 * from `flagCount` so "1 flag / 100 integrity" never appears.
 */
export function calculateIntegrity(
	logs: { severity: string; eventType?: string }[],
): IntegrityResult {
	const penalty = logs.reduce(
		(sum, l) => sum + (SEVERITY_WEIGHT[l.severity] ?? 0),
		0,
	);
	return {
		integrityScore: Math.max(0, 100 - penalty),
		flagCount: logs.filter(
			(l) => !(l.eventType && SYSTEM_EVENT_TYPES.has(l.eventType)),
		).length,
		cameraMonitorFailed: logs.some(
			(l) => l.eventType === "camera_monitor_unavailable",
		),
	};
}

export interface AutoSubmitInput {
	tabSwitches: number;
	tabSwitchLimit: number;
	fullscreenExits: number;
	fullscreenRequired: boolean;
}

/** Crossing either configured threshold forces the client to auto-submit. */
export function shouldAutoSubmit(input: AutoSubmitInput): boolean {
	return (
		input.tabSwitches >= input.tabSwitchLimit ||
		(input.fullscreenRequired && input.fullscreenExits >= 2)
	);
}
