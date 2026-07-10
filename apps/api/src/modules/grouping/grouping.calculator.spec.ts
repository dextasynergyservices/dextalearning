import { describe, expect, it } from "vitest";
import {
	type GroupingConfig,
	type GroupingLearner,
	type GroupingMode,
	groupCountFor,
	type PlannedGroup,
	planGroups,
} from "./grouping.calculator";

function config(overrides: Partial<GroupingConfig> = {}): GroupingConfig {
	return {
		mode: "randomized",
		targetGroupSize: 5,
		minGroupSize: 3,
		maxGroupSize: 8,
		...overrides,
	};
}

function learners(n: number, level: GroupingLearner["skillLevel"] = null) {
	return Array.from({ length: n }, (_, i) => ({
		userId: `u${String(i).padStart(2, "0")}`,
		skillLevel: level,
		enrolledAt: 1000 + i,
	}));
}

const allMembers = (groups: PlannedGroup[]) => groups.flatMap((g) => g.members);
const sizes = (groups: PlannedGroup[]) => groups.map((g) => g.members.length);

describe("groupCountFor", () => {
	it("is ceil(count / target), at least one for any learners", () => {
		expect(groupCountFor(0, config())).toBe(0);
		expect(groupCountFor(1, config({ targetGroupSize: 5 }))).toBe(1);
		expect(groupCountFor(5, config({ targetGroupSize: 5 }))).toBe(1);
		expect(groupCountFor(6, config({ targetGroupSize: 5 }))).toBe(2);
		expect(groupCountFor(23, config({ targetGroupSize: 5 }))).toBe(5);
	});
});

describe("planGroups — invariants across every mode", () => {
	const modes: GroupingMode[] = ["randomized", "skill_based", "balanced"];
	for (const mode of modes) {
		it(`${mode}: partitions every learner exactly once, into balanced-size groups`, () => {
			const people = learners(23);
			const groups = planGroups(people, config({ mode }), 42);

			// Every learner placed exactly once (a true partition).
			expect(allMembers(groups).sort()).toEqual(
				people.map((p) => p.userId).sort(),
			);
			// ceil(23/5) = 5 groups, sizes within 1 of each other, none over target.
			expect(groups).toHaveLength(5);
			expect(
				Math.max(...sizes(groups)) - Math.min(...sizes(groups)),
			).toBeLessThanOrEqual(1);
			expect(Math.max(...sizes(groups))).toBeLessThanOrEqual(
				config().targetGroupSize,
			);
		});
	}

	it("returns no groups for an empty cohort", () => {
		expect(planGroups([], config(), 1)).toEqual([]);
	});

	it("puts everyone in one group when under a target-size cohort", () => {
		const groups = planGroups(learners(4), config({ targetGroupSize: 5 }), 1);
		expect(groups).toHaveLength(1);
		expect(groups[0].members).toHaveLength(4);
	});
});

describe("planGroups — randomized", () => {
	it("is deterministic for a given seed and reshuffles for a new one", () => {
		const people = learners(12);
		const a = planGroups(people, config(), 7);
		const b = planGroups(people, config(), 7);
		const c = planGroups(people, config(), 999);
		expect(a).toEqual(b);
		// A different seed almost surely yields a different arrangement.
		expect(JSON.stringify(a)).not.toEqual(JSON.stringify(c));
		// Still a valid partition.
		expect(allMembers(c).sort()).toEqual(people.map((p) => p.userId).sort());
	});
});

describe("planGroups — skill_based", () => {
	it("round-robins the level-sorted list so each group gets a level mix", () => {
		// 3 of each level → 9 learners, target 3 → 3 groups; each group should
		// hold one beginner, one intermediate, one advanced.
		const people: GroupingLearner[] = [
			...learners(3, "beginner").map((p) => ({ ...p, userId: `b${p.userId}` })),
			...learners(3, "advanced").map((p) => ({ ...p, userId: `a${p.userId}` })),
			...learners(3, "intermediate").map((p) => ({
				...p,
				userId: `i${p.userId}`,
			})),
		];
		const groups = planGroups(
			people,
			config({ mode: "skill_based", targetGroupSize: 3 }),
			1,
		);
		expect(groups).toHaveLength(3);
		for (const g of groups) {
			const prefixes = g.members.map((m) => m[0]).sort();
			expect(prefixes).toEqual(["a", "b", "i"]);
		}
	});
});

describe("planGroups — balanced", () => {
	it("snake-distributes the sorted list into a valid, balanced partition", () => {
		const people: GroupingLearner[] = [
			...learners(2, "advanced").map((p) => ({ ...p, userId: `a${p.userId}` })),
			...learners(2, "beginner").map((p) => ({ ...p, userId: `b${p.userId}` })),
		];
		const groups = planGroups(
			people,
			config({ mode: "balanced", targetGroupSize: 2 }),
			1,
		);
		expect(groups).toHaveLength(2);
		// Snake on the level-sorted [b,b,a,a]: group0=[b0,a1], group1=[b1,a0] —
		// each group gets one beginner + one advanced.
		for (const g of groups) {
			expect(g.members.some((m) => m.startsWith("b"))).toBe(true);
			expect(g.members.some((m) => m.startsWith("a"))).toBe(true);
		}
	});
});

describe("planGroups — manual", () => {
	it("creates the target number of EMPTY groups (drag-and-drop containers)", () => {
		const groups = planGroups(
			learners(10),
			config({ mode: "manual", targetGroupSize: 5 }),
			1,
		);
		expect(groups).toHaveLength(2);
		expect(allMembers(groups)).toHaveLength(0);
	});
});
