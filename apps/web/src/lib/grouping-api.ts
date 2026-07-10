import { apiFetch } from "./api";

// Client for the Grouping context (§4.7). Admin/facilitator group management
// for a cohort — the drag-and-drop board plus the auto-grouping generator.

export type GroupingMode = "randomized" | "skill_based" | "balanced" | "manual";

export interface GroupMember {
	userId: string;
	name: string;
	skillLevel: string | null;
	role: "member" | "lead";
}

export interface UnassignedLearner {
	userId: string;
	name: string;
	skillLevel: string | null;
}

export interface CohortGroup {
	id: string;
	name: string | null;
	type: GroupingMode | null;
	members: GroupMember[];
}

export interface GroupingBoard {
	cohort: {
		id: string;
		title: string;
		groupingMode: GroupingMode;
		targetGroupSize: number;
		minGroupSize: number;
		maxGroupSize: number;
	};
	groups: CohortGroup[];
	unassigned: UnassignedLearner[];
}

const base = (cohortId: string) => `/cohorts/${cohortId}/grouping`;

export const getGroupingBoard = (cohortId: string) =>
	apiFetch<GroupingBoard>(base(cohortId));

/** (Re)generate all groups from the cohort's configured mode. */
export const generateGroups = (cohortId: string) =>
	apiFetch<GroupingBoard>(`${base(cohortId)}/generate`, { method: "POST" });

/** Move a learner into a group, or out of every group when `groupId` is null. */
export const assignLearner = (
	cohortId: string,
	userId: string,
	groupId: string | null,
) =>
	apiFetch<{ ok: true }>(`${base(cohortId)}/assign`, {
		method: "POST",
		body: JSON.stringify({ userId, groupId }),
	});

export const createGroup = (cohortId: string, name?: string) =>
	apiFetch<{ id: string; name: string | null }>(`${base(cohortId)}/groups`, {
		method: "POST",
		body: JSON.stringify(name ? { name } : {}),
	});

export const renameGroup = (cohortId: string, groupId: string, name: string) =>
	apiFetch<{ ok: true }>(`${base(cohortId)}/groups/${groupId}`, {
		method: "PATCH",
		body: JSON.stringify({ name }),
	});

export const deleteGroup = (cohortId: string, groupId: string) =>
	apiFetch<{ ok: true }>(`${base(cohortId)}/groups/${groupId}`, {
		method: "DELETE",
	});

export const setGroupLead = (
	cohortId: string,
	groupId: string,
	userId: string,
) =>
	apiFetch<{ ok: true }>(`${base(cohortId)}/groups/${groupId}/lead`, {
		method: "POST",
		body: JSON.stringify({ userId }),
	});
