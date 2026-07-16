import { apiFetch } from "./api";

/**
 * Admin user management (§8.7). Browse/search every account, change a global
 * role, suspend or restore access. Admin-only server-side.
 */

/** `facilitator` is a per-cohort assignment (§4.7), never granted globally. */
export const ASSIGNABLE_ROLES = ["learner", "instructor", "admin"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export interface AdminUserRow {
	id: string;
	name: string;
	email: string;
	role: string;
	image: string | null;
	emailVerified: boolean;
	phoneVerified: boolean;
	suspendedAt: string | null;
	suspendedReason: string | null;
	joinedAt: string;
	/** Content they've authored — the cost of demoting them, made visible. */
	createdCount: number;
	enrolmentCount: number;
}

export interface AdminUserList {
	rows: AdminUserRow[];
	total: number;
	page: number;
	pageSize: number;
	roleCounts: Record<string, number>;
}

export interface AdminUserQuery {
	search?: string;
	role?: string;
	status?: "active" | "suspended";
	page?: number;
}

export const adminUserKeys = {
	list: (q: AdminUserQuery) => ["admin", "users", q] as const,
};

export const listAdminUsers = (q: AdminUserQuery) => {
	const params = new URLSearchParams();
	if (q.search) params.set("search", q.search);
	if (q.role) params.set("role", q.role);
	if (q.status) params.set("status", q.status);
	if (q.page && q.page > 1) params.set("page", String(q.page));
	const qs = params.toString();
	return apiFetch<AdminUserList>(`/admin/users${qs ? `?${qs}` : ""}`);
};

export const setUserRole = (id: string, role: AssignableRole) =>
	apiFetch<AdminUserRow>(`/admin/users/${id}/role`, {
		method: "PATCH",
		body: JSON.stringify({ role }),
	});

export const suspendUser = (id: string, reason?: string) =>
	apiFetch<AdminUserRow>(`/admin/users/${id}/suspend`, {
		method: "POST",
		body: JSON.stringify({ reason }),
	});

export const restoreUser = (id: string) =>
	apiFetch<AdminUserRow>(`/admin/users/${id}/restore`, { method: "POST" });

/** Revoke every session without suspending — help, not punishment. */
export const signOutUserEverywhere = (id: string) =>
	apiFetch<{ revoked: number }>(`/admin/users/${id}/sign-out`, {
		method: "POST",
	});
