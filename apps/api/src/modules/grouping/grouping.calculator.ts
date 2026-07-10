/**
 * Pure grouping engine (§4.7 "Code-Based, No AI"; §6.4 rule 4 — no Prisma, no
 * NestJS, no I/O). Given the enrolled learners and a cohort's grouping config,
 * it deterministically plans the group membership. Randomness is seeded, so a
 * given (learners, config, seed) always yields the same plan — reproducible in
 * tests, and a re-group just passes a fresh seed.
 */

export type GroupingMode = "randomized" | "skill_based" | "balanced" | "manual";
export type SkillLevel = "beginner" | "intermediate" | "advanced" | null;

export interface GroupingLearner {
	userId: string;
	/** Onboarding self-assessed level; unknown sorts last. */
	skillLevel: SkillLevel;
	/** Enrolment instant as epoch ms — a stable, timezone-free sort key. */
	enrolledAt: number;
}

export interface GroupingConfig {
	mode: GroupingMode;
	targetGroupSize: number;
	minGroupSize: number;
	maxGroupSize: number;
}

/** One planned group — an ordered list of member user IDs (empty for manual). */
export interface PlannedGroup {
	members: string[];
}

const LEVEL_RANK: Record<string, number> = {
	beginner: 0,
	intermediate: 1,
	advanced: 2,
};

/** Unknown/blank level sorts after every known level. */
function levelRank(level: SkillLevel): number {
	return level && level in LEVEL_RANK ? LEVEL_RANK[level] : 3;
}

/** Deterministic PRNG (mulberry32) — a seed in, a stable [0,1) stream out. */
function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Seeded Fisher–Yates — a pure, reproducible shuffle. */
function seededShuffle<T>(items: readonly T[], seed: number): T[] {
	const out = [...items];
	const rnd = mulberry32(seed);
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * How many groups to create: `ceil(count / targetGroupSize)`, at least one.
 * With round-robin / snake distribution this keeps every group's size within 1
 * of the others, so no group exceeds the target (and thus the max) size.
 */
export function groupCountFor(
	learnerCount: number,
	config: GroupingConfig,
): number {
	if (learnerCount <= 0) return 0;
	return Math.max(1, Math.ceil(learnerCount / config.targetGroupSize));
}

/** Round-robin: learner at position i lands in group `i % numGroups`. */
function roundRobin(
	order: GroupingLearner[],
	numGroups: number,
): PlannedGroup[] {
	const groups: PlannedGroup[] = Array.from({ length: numGroups }, () => ({
		members: [],
	}));
	order.forEach((learner, i) => {
		groups[i % numGroups].members.push(learner.userId);
	});
	return groups;
}

/** Snake (boustrophedon): fill L→R, then R→L, alternating each pass — mixes an
 *  ordered list evenly so each group gets a spread from across the ordering. */
function snake(order: GroupingLearner[], numGroups: number): PlannedGroup[] {
	const groups: PlannedGroup[] = Array.from({ length: numGroups }, () => ({
		members: [],
	}));
	order.forEach((learner, i) => {
		const row = Math.floor(i / numGroups);
		const col = i % numGroups;
		const target = row % 2 === 0 ? col : numGroups - 1 - col;
		groups[target].members.push(learner.userId);
	});
	return groups;
}

/**
 * Plan a cohort's groups. Returns one `PlannedGroup` per group, in order.
 *
 * - `randomized`  — seeded Fisher–Yates, then round-robin.
 * - `skill_based` — sort by level, then round-robin (each group gets a level mix).
 * - `balanced`    — sort by (level, enrolment date), then snake (an even spread).
 * - `manual`      — creates the target number of EMPTY groups for the admin to
 *                   fill by drag-and-drop; no learner is auto-assigned.
 */
export function planGroups(
	learners: readonly GroupingLearner[],
	config: GroupingConfig,
	seed: number,
): PlannedGroup[] {
	const numGroups = groupCountFor(learners.length, config);
	if (numGroups === 0) return [];

	if (config.mode === "manual") {
		return Array.from({ length: numGroups }, () => ({ members: [] }));
	}

	if (config.mode === "randomized") {
		return roundRobin(seededShuffle(learners, seed), numGroups);
	}

	const byLevel = [...learners].sort(
		(a, b) =>
			levelRank(a.skillLevel) - levelRank(b.skillLevel) ||
			a.enrolledAt - b.enrolledAt ||
			a.userId.localeCompare(b.userId),
	);

	if (config.mode === "skill_based") {
		return roundRobin(byLevel, numGroups);
	}
	// balanced
	return snake(byLevel, numGroups);
}
