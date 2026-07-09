// Client for the Engagement + Notifications bounded contexts (Phase 4, §3.2):
// streaks, badges, social proof and the in-app notification bell. Kept apart
// from content-api.ts to mirror the API's context boundaries (§6.4).
import { apiFetch } from "./api";

// ── Engagement (/engagement) ────────────────────────────────────────────────

export interface StreakState {
	current: number;
	longest: number;
	freezes: number;
	lastActiveDate: string | null;
	/** Active yesterday but not yet today — the flame is about to go out. */
	atRisk: boolean;
	todayDone: boolean;
}

export interface WeekActivityDay {
	/** Local date (YYYY-MM-DD) in the user's timezone; today is last. */
	date: string;
	active: boolean;
}

export interface EarnedBadge {
	key: string;
	awardedAt: string;
	seen: boolean;
}

export interface NextBadge {
	key: string;
	/** Progress toward the badge, clamped to its target. */
	current: number;
	target: number;
}

export interface EngagementMe {
	streak: StreakState;
	weekActivity: WeekActivityDay[];
	badges: EarnedBadge[];
	unseenBadgeKeys: string[];
	/** Full badge catalogue, so the awards grid can render locked ones. */
	allBadgeKeys: string[];
	/** §3.2 goal gradient — the nearest locked countable badge. */
	nextBadge: NextBadge | null;
}

export const engagementKeys = {
	me: ["engagement", "me"] as const,
	socialProof: (courseId: string) => ["social-proof", courseId] as const,
	notifications: ["notifications"] as const,
};

export function getEngagementMe(): Promise<EngagementMe> {
	return apiFetch<EngagementMe>("/engagement/me");
}

export function markBadgesSeen(keys: string[]): Promise<{ ok: true }> {
	return apiFetch<{ ok: true }>("/engagement/badges/seen", {
		method: "POST",
		body: JSON.stringify({ keys }),
	});
}

export interface CourseSocialProof {
	completedThisWeek: number;
}

/** Public — powers "N completed this week" on course pages (§3.2). */
export function getCourseSocialProof(
	courseId: string,
): Promise<CourseSocialProof> {
	return apiFetch<CourseSocialProof>(
		`/engagement/social-proof?courseId=${encodeURIComponent(courseId)}`,
	);
}

// ── Notifications (/notifications) ──────────────────────────────────────────

export interface AppNotification {
	id: string;
	/** i18n discriminator, e.g. "reminder_digest" | "badge_awarded". */
	type: string;
	/** Structured payload the client renders — no server copy. */
	data: Record<string, unknown> | null;
	readAt: string | null;
	createdAt: string;
}

export interface NotificationPage {
	notifications: AppNotification[];
	nextCursor: string | null;
	unreadCount: number;
}

export function listNotifications(options?: {
	limit?: number;
	cursor?: string;
}): Promise<NotificationPage> {
	const params = new URLSearchParams();
	if (options?.limit) params.set("limit", String(options.limit));
	if (options?.cursor) params.set("cursor", options.cursor);
	const qs = params.toString();
	return apiFetch<NotificationPage>(`/notifications${qs ? `?${qs}` : ""}`);
}

export function markNotificationRead(id: string): Promise<{ ok: true }> {
	return apiFetch<{ ok: true }>(`/notifications/${id}/read`, {
		method: "POST",
	});
}

export function markAllNotificationsRead(): Promise<{ ok: true }> {
	return apiFetch<{ ok: true }>("/notifications/read-all", {
		method: "POST",
	});
}
