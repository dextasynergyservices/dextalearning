import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";

/** Author fields surfaced with each message (initials-avatar friendly). */
const AUTHOR_SELECT = {
	id: true,
	name: true,
	firstName: true,
	lastName: true,
} as const;

type AuthorRow = {
	id: string;
	name: string | null;
	firstName: string;
	lastName: string;
};

function authorName(u: AuthorRow | null): string {
	if (!u) return "Unknown";
	return u.name?.trim() || `${u.firstName} ${u.lastName}`.trim() || "Unknown";
}

export interface ChatMessage {
	id: string;
	groupId: string;
	userId: string;
	authorName: string;
	content: string;
	createdAt: Date;
}

/** The minimal actor shape both HTTP and the WS gateway can supply. */
type Actor = Pick<AuthenticatedUser, "id" | "role">;

/**
 * Community chat context (§6.4) — owns `group_messages`. It authorises access
 * against `group_members` (and, for staff, `cohort_facilitators`), persists
 * messages, and serves history. The gateway handles transport; all the rules
 * live here so they're reused by REST history and the socket alike.
 */
@Injectable()
export class ChatService {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Confirms the actor may see/post in a group: a member, an admin, or an
	 * assigned facilitator of the group's cohort. Returns the group's cohortId.
	 */
	async assertAccess(actor: Actor, groupId: string): Promise<string | null> {
		const group = await this.prisma.group.findUnique({
			where: { id: groupId },
			select: { id: true, cohortId: true },
		});
		if (!group) throw new NotFoundException("Group not found");
		if (actor.role === "admin") return group.cohortId;

		const member = await this.prisma.groupMember.findUnique({
			where: { groupId_userId: { groupId, userId: actor.id } },
			select: { userId: true },
		});
		if (member) return group.cohortId;

		if (group.cohortId) {
			const facilitator = await this.prisma.cohortFacilitator.findUnique({
				where: {
					cohortId_userId: { cohortId: group.cohortId, userId: actor.id },
				},
				select: { cohortId: true },
			});
			if (facilitator) return group.cohortId;
		}
		throw new ForbiddenException("You're not a member of this group.");
	}

	private toMessage(row: {
		id: string;
		groupId: string | null;
		userId: string | null;
		content: string | null;
		createdAt: Date;
		user: AuthorRow | null;
	}): ChatMessage {
		return {
			id: row.id,
			groupId: row.groupId ?? "",
			userId: row.userId ?? "",
			authorName: authorName(row.user),
			content: row.content ?? "",
			createdAt: row.createdAt,
		};
	}

	/** Group header + roster for the chat screen (authorised). */
	async groupInfo(actor: Actor, groupId: string) {
		await this.assertAccess(actor, groupId);
		const group = await this.prisma.group.findUnique({
			where: { id: groupId },
			select: {
				id: true,
				name: true,
				cohort: { select: { title: true } },
				members: {
					orderBy: { assignedAt: "asc" },
					select: { role: true, user: { select: AUTHOR_SELECT } },
				},
			},
		});
		if (!group) throw new NotFoundException("Group not found");
		return {
			id: group.id,
			name: group.name,
			cohortTitle: group.cohort?.title ?? null,
			members: group.members.map((m) => ({
				userId: m.user.id,
				name: authorName(m.user),
				role: m.role,
			})),
		};
	}

	/** Newest-first history with cursor pagination, returned ascending for display. */
	async history(actor: Actor, groupId: string, limit: number, cursor?: string) {
		await this.assertAccess(actor, groupId);
		const take = Math.max(1, Math.min(50, limit));
		const rows = await this.prisma.groupMessage.findMany({
			where: { groupId },
			orderBy: { createdAt: "desc" },
			take: take + 1,
			...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
			select: {
				id: true,
				groupId: true,
				userId: true,
				content: true,
				createdAt: true,
				user: { select: AUTHOR_SELECT },
			},
		});
		const page = rows.slice(0, take);
		return {
			messages: page.map((r) => this.toMessage(r)).reverse(),
			nextCursor: rows.length > take ? page[page.length - 1]?.id : null,
		};
	}

	/** Persist a message (caller must have already authorised the actor). */
	async saveMessage(
		userId: string,
		groupId: string,
		content: string,
	): Promise<ChatMessage> {
		const row = await this.prisma.groupMessage.create({
			data: { groupId, userId, content },
			select: {
				id: true,
				groupId: true,
				userId: true,
				content: true,
				createdAt: true,
				user: { select: AUTHOR_SELECT },
			},
		});
		return this.toMessage(row);
	}

	/** Every group the user belongs to (for a global "my groups" view). */
	async myGroups(userId: string) {
		const rows = await this.prisma.groupMember.findMany({
			where: { userId },
			orderBy: { assignedAt: "desc" },
			select: {
				group: {
					select: {
						id: true,
						name: true,
						cohortId: true,
						cohort: { select: { title: true } },
						_count: { select: { members: true } },
					},
				},
			},
		});
		return rows.map((r) => ({
			id: r.group.id,
			name: r.group.name,
			cohortId: r.group.cohortId,
			cohortTitle: r.group.cohort?.title ?? null,
			memberCount: r.group._count.members,
		}));
	}

	/** The user's group within a specific cohort (or null) — for the cohort hub. */
	async myGroupInCohort(userId: string, cohortId: string) {
		const row = await this.prisma.groupMember.findFirst({
			where: { userId, group: { cohortId } },
			select: {
				group: {
					select: {
						id: true,
						name: true,
						_count: { select: { members: true } },
					},
				},
			},
		});
		if (!row) return null;
		return {
			id: row.group.id,
			name: row.group.name,
			memberCount: row.group._count.members,
		};
	}
}
