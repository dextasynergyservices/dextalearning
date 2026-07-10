import { apiFetch } from "./api";

// REST surface for group chat (§4.7 community). Live messaging is handled by
// the Socket.io hook (use-group-chat.ts); these cover history + discovery.

export interface ChatMessage {
	id: string;
	groupId: string;
	userId: string;
	authorName: string;
	content: string;
	createdAt: string;
}

export interface GroupMemberSummary {
	userId: string;
	name: string;
	role: "member" | "lead";
}

export interface GroupInfo {
	id: string;
	name: string | null;
	cohortTitle: string | null;
	members: GroupMemberSummary[];
}

export interface MyGroupSummary {
	id: string;
	name: string | null;
	cohortId: string | null;
	cohortTitle: string | null;
	memberCount: number;
}

export interface MyGroupInCohort {
	id: string;
	name: string | null;
	memberCount: number;
}

export interface MessagePage {
	messages: ChatMessage[];
	nextCursor: string | null;
}

export const getGroupInfo = (groupId: string) =>
	apiFetch<GroupInfo>(`/groups/${groupId}`);

export const getGroupMessages = (groupId: string, cursor?: string) =>
	apiFetch<MessagePage>(
		`/groups/${groupId}/messages${cursor ? `?cursor=${cursor}` : ""}`,
	);

export const getMyGroups = () => apiFetch<MyGroupSummary[]>("/groups/mine");

export const getMyGroupInCohort = (cohortId: string) =>
	apiFetch<MyGroupInCohort | null>(`/groups/in-cohort/${cohortId}`);

export const chatKeys = {
	info: (groupId: string) => ["chat", "info", groupId] as const,
	messages: (groupId: string) => ["chat", "messages", groupId] as const,
	myGroupInCohort: (cohortId: string) =>
		["chat", "my-group", cohortId] as const,
};
