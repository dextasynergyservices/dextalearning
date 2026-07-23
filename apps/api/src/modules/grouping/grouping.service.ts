import {
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/types";
import { renderNotificationEmail } from "../../emails/render";
import { PrismaService } from "../../prisma/prisma.service";
import { DropoffQueryService } from "../dropoff/dropoff-query.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
	type GroupingMode,
	planGroups,
	type SkillLevel,
} from "./grouping.calculator";
import { GROUP_ASSIGNMENT_COPY, groupingLanguageOf } from "./grouping.messages";

/** Member fields surfaced to the management UI (initials-avatar friendly). */
const MEMBER_SELECT = {
	id: true,
	name: true,
	firstName: true,
	lastName: true,
	email: true,
	skillLevel: true,
} as const;

type MemberRow = {
	id: string;
	name: string | null;
	firstName: string;
	lastName: string;
	email: string;
	skillLevel: string | null;
};

function toMember(u: MemberRow) {
	return {
		userId: u.id,
		name: u.name?.trim() || `${u.firstName} ${u.lastName}`.trim() || u.email,
		skillLevel: u.skillLevel,
	};
}

/**
 * Grouping context (§4.7, §6.4): owns `groups` + `group_members`. It plans
 * membership with the pure `planGroups` calculator, persists the result, and —
 * on a re-group — notifies learners whose group changed (§8.6 "Group
 * reassigned") through the sanctioned `NotificationsService`. It reads the
 * cohort roster (enrolments + self-assessed level) as a snapshot at the moment
 * of grouping; it never writes another context's tables.
 */
@Injectable()
export class GroupingService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly notifications: NotificationsService,
		private readonly dropoff: DropoffQueryService,
	) {}

	private async loadCohort(cohortId: string) {
		const cohort = await this.prisma.cohort.findUnique({
			where: { id: cohortId },
			select: {
				id: true,
				title: true,
				groupingMode: true,
				targetGroupSize: true,
				minGroupSize: true,
				maxGroupSize: true,
			},
		});
		if (!cohort) throw new NotFoundException("Cohort not found");
		return cohort;
	}

	/**
	 * Admin manages any cohort; anyone assigned as this cohort's facilitator
	 * manages it too — facilitation is a per-cohort assignment, not a global
	 * role, so the check is the `CohortFacilitator` link, not `actor.role`
	 * (a learner or instructor can be promoted to facilitate a cohort, §4.7).
	 */
	private async authorize(actor: AuthenticatedUser, cohortId: string) {
		if (actor.role === "admin") return;
		const link = await this.prisma.cohortFacilitator.findUnique({
			where: { cohortId_userId: { cohortId, userId: actor.id } },
			select: { cohortId: true },
		});
		if (link) return;
		throw new ForbiddenException("You don't manage this cohort's groups.");
	}

	/** Cohorts the current user is assigned to facilitate (the portal's home). */
	async myFacilitatedCohorts(actor: AuthenticatedUser) {
		const links = await this.prisma.cohortFacilitator.findMany({
			where: { userId: actor.id },
			orderBy: { assignedAt: "desc" },
			select: {
				cohort: {
					select: {
						id: true,
						title: true,
						slug: true,
						status: true,
						startsAt: true,
						groupingMode: true,
						_count: { select: { enrollments: true, groups: true } },
					},
				},
			},
		});
		const atRisk = await this.dropoff.atRiskCountsFor(
			links.map((l) => l.cohort.id),
		);
		return links.map((l) => ({
			id: l.cohort.id,
			title: l.cohort.title,
			slug: l.cohort.slug,
			status: l.cohort.status,
			startsAt: l.cohort.startsAt,
			groupingMode: l.cohort.groupingMode,
			learnerCount: l.cohort._count.enrollments,
			groupCount: l.cohort._count.groups,
			atRiskCount: atRisk.get(l.cohort.id)?.total ?? 0,
		}));
	}

	private async rosterOf(cohortId: string) {
		return this.prisma.cohortEnrollment.findMany({
			where: { cohortId, NOT: { status: "dropped" } },
			select: {
				userId: true,
				enrolledAt: true,
				user: { select: { skillLevel: true } },
			},
		});
	}

	/** userId → the set of co-members (including self) in its group. */
	private coMemberSets(groups: string[][]): Map<string, string> {
		const map = new Map<string, string>();
		for (const members of groups) {
			const key = [...members].sort().join(",");
			for (const userId of members) map.set(userId, key);
		}
		return map;
	}

	/**
	 * (Re)generate all groups for a cohort from its configured mode. Wipes the
	 * previous grouping and rebuilds it in one transaction. On a re-group (there
	 * were prior groups), learners whose group changed are notified.
	 */
	async generateGroups(actor: AuthenticatedUser, cohortId: string) {
		const cohort = await this.loadCohort(cohortId);
		await this.authorize(actor, cohortId);

		const enrollments = await this.rosterOf(cohortId);
		const learners = enrollments.map((e) => ({
			userId: e.userId,
			skillLevel: (e.user.skillLevel as SkillLevel) ?? null,
			enrolledAt: e.enrolledAt.getTime(),
		}));

		const existing = await this.prisma.group.findMany({
			where: { cohortId },
			select: { id: true, members: { select: { userId: true } } },
		});
		const hadPrior = existing.length > 0;
		const oldSets = this.coMemberSets(
			existing.map((g) => g.members.map((m) => m.userId)),
		);

		const planned = planGroups(
			learners,
			{
				mode: cohort.groupingMode as GroupingMode,
				targetGroupSize: cohort.targetGroupSize,
				minGroupSize: cohort.minGroupSize,
				maxGroupSize: cohort.maxGroupSize,
			},
			Date.now() >>> 0,
		);

		await this.prisma.$transaction(async (tx) => {
			const ids = existing.map((g) => g.id);
			if (ids.length) {
				await tx.groupMember.deleteMany({ where: { groupId: { in: ids } } });
				await tx.group.deleteMany({ where: { id: { in: ids } } });
			}
			for (let i = 0; i < planned.length; i++) {
				const group = await tx.group.create({
					data: {
						cohortId,
						name: `Group ${i + 1}`,
						type: cohort.groupingMode,
					},
				});
				if (planned[i].members.length) {
					await tx.groupMember.createMany({
						data: planned[i].members.map((userId) => ({
							groupId: group.id,
							userId,
						})),
					});
				}
			}
		});

		if (hadPrior) {
			const newSets = this.coMemberSets(planned.map((g) => g.members));
			const groupNameOf = new Map<string, string>();
			planned.forEach((g, i) => {
				for (const userId of g.members)
					groupNameOf.set(userId, `Group ${i + 1}`);
			});
			const changed = learners
				.filter((l) => oldSets.get(l.userId) !== newSets.get(l.userId))
				.map((l) => l.userId);
			await this.notifyReassigned(cohort.title, changed, groupNameOf);
		}

		return this.listGroups(actor, cohortId);
	}

	/** Fan out "your group changed" notices (§8.6). Never throws (best-effort). */
	private async notifyReassigned(
		cohortTitle: string,
		userIds: string[],
		groupNameOf: Map<string, string>,
	) {
		if (userIds.length === 0) return;
		const users = await this.prisma.user.findMany({
			where: { id: { in: userIds } },
			select: {
				id: true,
				firstName: true,
				email: true,
				phone: true,
				whatsappOptIn: true,
				language: true,
			},
		});
		await Promise.allSettled(
			users.map(async (u) => {
				const groupName = groupNameOf.get(u.id);
				if (!groupName) return Promise.resolve();
				const copy = GROUP_ASSIGNMENT_COPY[groupingLanguageOf(u.language)];
				const ctx = { firstName: u.firstName, cohortTitle, groupName };
				return this.notifications.notify(u.id, {
					type: "group_reassigned",
					dataJson: { cohortTitle, groupName },
					inApp: true,
					email: {
						to: u.email,
						subject: copy.subject(ctx),
						html: await renderNotificationEmail({
							preview: copy.subject(ctx),
							heading: copy.heading(ctx),
							paragraphs: [copy.body(ctx)],
							cta: "Open my cohort",
							// `/learn/groups` has no route — only `/learn/groups/$groupId`,
							// and the group id doesn't exist yet when this fires (groups are
							// planned in memory). Send them to their cohorts instead.
							ctaUrl: `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/learn/mine`,
						}),
					},
					...(u.phone && u.whatsappOptIn
						? { whatsapp: { phone: u.phone, message: copy.whatsapp(ctx) } }
						: {}),
					push: {
						title: copy.subject(ctx),
						body: copy.body(ctx),
						// Match the in-app bell and the email: their cohorts.
						url: "/learn/mine",
						tag: "group_reassigned",
					},
				});
			}),
		);
	}

	/** The full grouping board: config, groups with members, and the unassigned. */
	async listGroups(actor: AuthenticatedUser, cohortId: string) {
		const cohort = await this.loadCohort(cohortId);
		await this.authorize(actor, cohortId);

		const groups = await this.prisma.group.findMany({
			where: { cohortId },
			orderBy: { createdAt: "asc" },
			select: {
				id: true,
				name: true,
				type: true,
				members: {
					orderBy: { assignedAt: "asc" },
					select: { role: true, user: { select: MEMBER_SELECT } },
				},
			},
		});
		const enrollments = await this.prisma.cohortEnrollment.findMany({
			where: { cohortId, NOT: { status: "dropped" } },
			select: { user: { select: MEMBER_SELECT } },
		});
		const assigned = new Set(
			groups.flatMap((g) => g.members.map((m) => m.user.id)),
		);

		return {
			cohort: {
				id: cohort.id,
				title: cohort.title,
				groupingMode: cohort.groupingMode,
				targetGroupSize: cohort.targetGroupSize,
				minGroupSize: cohort.minGroupSize,
				maxGroupSize: cohort.maxGroupSize,
			},
			groups: groups.map((g) => ({
				id: g.id,
				name: g.name,
				type: g.type,
				members: g.members.map((m) => ({
					...toMember(m.user),
					role: m.role,
				})),
			})),
			unassigned: enrollments
				.filter((e) => !assigned.has(e.user.id))
				.map((e) => toMember(e.user)),
		};
	}

	private async assertGroupInCohort(cohortId: string, groupId: string) {
		const group = await this.prisma.group.findFirst({
			where: { id: groupId, cohortId },
			select: { id: true },
		});
		if (!group) throw new NotFoundException("Group not found in this cohort");
	}

	private async assertEnrolled(cohortId: string, userId: string) {
		const enrolled = await this.prisma.cohortEnrollment.findUnique({
			where: { cohortId_userId: { cohortId, userId } },
			select: { userId: true },
		});
		if (!enrolled) {
			throw new UnprocessableEntityException({
				code: "NOT_ENROLLED",
				message: "That learner isn't enrolled in this cohort.",
			});
		}
	}

	/**
	 * Move a learner into `toGroupId`, or out of every group when it's null
	 * (manual drag-and-drop). One group per learner per cohort. Drag-and-drop
	 * moves don't notify — that would spam while an admin arranges the board;
	 * the bulk re-group is the notifying action.
	 */
	async manualAssign(
		actor: AuthenticatedUser,
		cohortId: string,
		userId: string,
		toGroupId: string | null,
	) {
		await this.loadCohort(cohortId);
		await this.authorize(actor, cohortId);
		await this.assertEnrolled(cohortId, userId);
		if (toGroupId) await this.assertGroupInCohort(cohortId, toGroupId);

		const cohortGroupIds = (
			await this.prisma.group.findMany({
				where: { cohortId },
				select: { id: true },
			})
		).map((g) => g.id);

		await this.prisma.$transaction(async (tx) => {
			await tx.groupMember.deleteMany({
				where: { userId, groupId: { in: cohortGroupIds } },
			});
			if (toGroupId) {
				await tx.groupMember.create({ data: { groupId: toGroupId, userId } });
			}
		});
		return { ok: true as const };
	}

	async createGroup(actor: AuthenticatedUser, cohortId: string, name?: string) {
		const cohort = await this.loadCohort(cohortId);
		await this.authorize(actor, cohortId);
		const count = await this.prisma.group.count({ where: { cohortId } });
		const group = await this.prisma.group.create({
			data: {
				cohortId,
				name: name?.trim() || `Group ${count + 1}`,
				type: cohort.groupingMode,
			},
			select: { id: true, name: true },
		});
		return group;
	}

	async renameGroup(
		actor: AuthenticatedUser,
		cohortId: string,
		groupId: string,
		name: string,
	) {
		await this.authorize(actor, cohortId);
		await this.assertGroupInCohort(cohortId, groupId);
		await this.prisma.group.update({
			where: { id: groupId },
			data: { name: name.trim() },
		});
		return { ok: true as const };
	}

	async deleteGroup(
		actor: AuthenticatedUser,
		cohortId: string,
		groupId: string,
	) {
		await this.authorize(actor, cohortId);
		await this.assertGroupInCohort(cohortId, groupId);
		await this.prisma.$transaction([
			this.prisma.groupMember.deleteMany({ where: { groupId } }),
			this.prisma.group.delete({ where: { id: groupId } }),
		]);
		return { ok: true as const };
	}

	/** Promote one member to group lead; the rest of the group become members. */
	async setLead(
		actor: AuthenticatedUser,
		cohortId: string,
		groupId: string,
		userId: string,
	) {
		await this.authorize(actor, cohortId);
		await this.assertGroupInCohort(cohortId, groupId);
		const member = await this.prisma.groupMember.findUnique({
			where: { groupId_userId: { groupId, userId } },
			select: { userId: true },
		});
		if (!member)
			throw new NotFoundException("That learner isn't in this group");
		await this.prisma.$transaction([
			this.prisma.groupMember.updateMany({
				where: { groupId },
				data: { role: "member" },
			}),
			this.prisma.groupMember.update({
				where: { groupId_userId: { groupId, userId } },
				data: { role: "lead" },
			}),
		]);
		return { ok: true as const };
	}
}
