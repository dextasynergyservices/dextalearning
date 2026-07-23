import { Injectable, Logger } from "@nestjs/common";
import { renderNotificationEmail } from "../../emails/render";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

/** How far ahead a due date counts as "approaching" (§8.6). */
const DEADLINE_WINDOW_HOURS = 72;

/**
 * How far BACK the kickoff sweep looks. A kickoff is a one-off moment, so if the
 * sweep misses the day it happened — a sleeping container, a failed run — looking
 * only at "today" loses it forever. Looking back a few days lets a late run catch
 * up, and the per-cohort dedup below stops that becoming a repeat.
 */
const KICKOFF_CATCHUP_DAYS = 3;

/** `ReminderLog.kind` values — VarChar(20), so keep these short. */
const KIND_DEADLINE = "deadline_soon";

/**
 * Dedup key for a kickoff: `ck_` + the cohort's id, stripped of dashes and cut to
 * fit `kind`'s VarChar(20). Encoding the cohort into the key (rather than using a
 * single "cohort_kickoff" kind) is what makes the notice exactly-once **per
 * learner per cohort** instead of per learner per day — otherwise someone in two
 * cohorts starting the same day would silently only hear about one of them.
 * 16 hex chars is 64 bits of the UUID; collisions are not a practical concern.
 */
function kickoffKind(cohortId: string): string {
	return `ck_${cohortId.replace(/-/g, "").slice(0, 16)}`;
}

interface DueItem {
	kind: "project" | "assessment";
	title: string;
	dueAt: Date;
}

/**
 * Daily lifecycle sweep for the two §8.6 notices that are driven by the calendar
 * rather than by something a user just did: **cohort kickoff** and **deadline
 * approaching**.
 *
 * Both dedupe through `ReminderLog` (`@@unique([userId, kind, sentOn])`), so a
 * re-run — or a fail-open double-fire from the cron lock — can't spam anyone.
 * Deadlines are batched into ONE notice per learner per day listing everything
 * that's due; a notice per item is how people learn to ignore notifications.
 */
@Injectable()
export class LifecycleRemindersService {
	private readonly logger = new Logger(LifecycleRemindersService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly notifications: NotificationsService,
	) {}

	async sweep(now: Date = new Date()): Promise<{
		kickoffs: number;
		deadlines: number;
	}> {
		const [kickoffs, deadlines] = await Promise.all([
			this.sweepKickoffs(now),
			this.sweepDeadlines(now),
		]);
		return { kickoffs, deadlines };
	}

	/** Today's UTC day window. Deliberately UTC rather than a per-user local day:
	 *  a kickoff is a property of the cohort, not of who's reading about it. */
	private dayWindow(now: Date): { start: Date; end: Date; sentOn: Date } {
		const start = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
		);
		const end = new Date(start);
		end.setUTCDate(end.getUTCDate() + 1);
		return { start, end, sentOn: start };
	}

	/** True if this is the first time today we're telling them about `kind`. */
	private async claim(
		userId: string,
		kind: string,
		sentOn: Date,
	): Promise<boolean> {
		try {
			await this.prisma.reminderLog.create({ data: { userId, kind, sentOn } });
			return true;
		} catch {
			// Unique violation — already sent today.
			return false;
		}
	}

	// ── Cohort kickoff ───────────────────────────────────────────────────────
	/**
	 * Catch-up-safe by construction: it looks back `KICKOFF_CATCHUP_DAYS`, and the
	 * dedup is keyed on the COHORT (not on "today"), with `sentOn` pinned to the
	 * cohort's own start day. So a sweep that runs late — or twice, or every day
	 * for a week — still sends each learner exactly one notice per cohort.
	 */
	private async sweepKickoffs(now: Date): Promise<number> {
		const { end } = this.dayWindow(now);
		const from = new Date(end);
		from.setUTCDate(from.getUTCDate() - KICKOFF_CATCHUP_DAYS);
		const cohorts = await this.prisma.cohort.findMany({
			// Started within the catch-up window, and not in the future.
			where: { startsAt: { gte: from, lt: end } },
			select: { id: true, title: true, startsAt: true },
		});
		if (cohorts.length === 0) return 0;

		let sent = 0;
		for (const cohort of cohorts) {
			// Pin the dedup to the cohort's start day so it's stable across runs.
			const startedOn = cohort.startsAt as Date;
			const sentOn = new Date(
				Date.UTC(
					startedOn.getUTCFullYear(),
					startedOn.getUTCMonth(),
					startedOn.getUTCDate(),
				),
			);
			const kind = kickoffKind(cohort.id);
			const enrolments = await this.prisma.cohortEnrollment.findMany({
				where: { cohortId: cohort.id },
				select: {
					user: { select: { id: true, email: true, firstName: true } },
				},
			});
			for (const { user } of enrolments) {
				if (!user) continue;
				if (!(await this.claim(user.id, kind, sentOn))) continue;
				await this.safeNotify(user.id, {
					type: "cohort_kickoff",
					dataJson: { cohortTitle: cohort.title, cohortId: cohort.id },
					inApp: true,
					email: {
						to: user.email,
						subject: `${cohort.title} has started`,
						html: await renderNotificationEmail({
							preview: `${cohort.title} has started`,
							heading: `${cohort.title} has started`,
							paragraphs: [
								`Hi ${user.firstName}, your cohort is under way.`,
								"Open it to meet your group and start the first course.",
							],
							cta: "Open my cohort",
							ctaUrl: `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/learn/cohort/${cohort.id}`,
						}),
					},
					push: {
						title: `${cohort.title} has started`,
						body: "Your cohort is under way — open it to get going.",
						url: `/learn/cohort/${cohort.id}`,
						tag: "cohort-kickoff",
					},
				});
				sent += 1;
			}
		}
		return sent;
	}

	// ── Deadline approaching ─────────────────────────────────────────────────
	private async sweepDeadlines(now: Date): Promise<number> {
		const until = new Date(now.getTime() + DEADLINE_WINDOW_HOURS * 3_600_000);
		const { sentOn } = this.dayWindow(now);

		const [projects, assessments] = await Promise.all([
			this.prisma.project.findMany({
				where: { dueAt: { gt: now, lte: until } },
				select: {
					id: true,
					title: true,
					dueAt: true,
					courseId: true,
					pathId: true,
					cohortId: true,
				},
			}),
			this.prisma.assessment.findMany({
				where: { dueAt: { gt: now, lte: until } },
				select: {
					id: true,
					title: true,
					dueAt: true,
					courseId: true,
					pathId: true,
					cohortId: true,
				},
			}),
		]);
		if (projects.length === 0 && assessments.length === 0) return 0;

		// userId -> the things they still owe.
		const owed = new Map<string, DueItem[]>();
		const add = (userId: string, item: DueItem) => {
			const list = owed.get(userId);
			if (list) list.push(item);
			else owed.set(userId, [item]);
		};

		for (const project of projects) {
			const audience = await this.audienceFor(project);
			if (audience.length === 0) continue;
			const done = new Set(
				(
					await this.prisma.projectSubmission.findMany({
						where: { projectId: project.id, userId: { in: audience } },
						select: { userId: true },
					})
				).map((s) => s.userId ?? ""),
			);
			for (const userId of audience) {
				if (done.has(userId)) continue;
				add(userId, {
					kind: "project",
					title: project.title,
					dueAt: project.dueAt as Date,
				});
			}
		}

		for (const assessment of assessments) {
			const audience = await this.audienceFor(assessment);
			if (audience.length === 0) continue;
			const passed = new Set(
				(
					await this.prisma.assessmentAttempt.findMany({
						where: {
							assessmentId: assessment.id,
							userId: { in: audience },
							passed: true,
						},
						select: { userId: true },
					})
				).map((a) => a.userId ?? ""),
			);
			for (const userId of audience) {
				if (passed.has(userId)) continue;
				add(userId, {
					kind: "assessment",
					title: assessment.title ?? "Assessment",
					dueAt: assessment.dueAt as Date,
				});
			}
		}

		let sent = 0;
		for (const [userId, items] of owed) {
			if (!(await this.claim(userId, KIND_DEADLINE, sentOn))) continue;
			const user = await this.prisma.user.findUnique({
				where: { id: userId },
				select: { email: true, firstName: true },
			});
			if (!user) continue;
			items.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
			const lines = items.map(
				(i) => `${i.title} — due ${i.dueAt.toDateString()}`,
			);
			const headline =
				items.length === 1
					? `${items[0].title} is due soon`
					: `${items.length} things are due soon`;
			await this.safeNotify(userId, {
				type: "deadline_soon",
				dataJson: { count: items.length, first: items[0].title },
				inApp: true,
				email: {
					to: user.email,
					subject: headline,
					html: await renderNotificationEmail({
						preview: headline,
						heading: headline,
						paragraphs: [
							`Hi ${user.firstName}, here's what's coming up:`,
							...lines,
						],
						cta: "Open my learning",
						ctaUrl: `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/learn/mine`,
					}),
				},
				push: {
					title: headline,
					body: lines[0],
					url: "/learn/mine",
					tag: "deadline-soon",
				},
			});
			sent += 1;
		}
		return sent;
	}

	/** Who is on the hook for something attached to a course, path or cohort. */
	private async audienceFor(parent: {
		courseId: string | null;
		pathId: string | null;
		cohortId: string | null;
	}): Promise<string[]> {
		if (parent.cohortId) {
			const rows = await this.prisma.cohortEnrollment.findMany({
				where: { cohortId: parent.cohortId },
				select: { userId: true },
			});
			return rows.map((r) => r.userId);
		}
		if (parent.pathId) {
			const rows = await this.prisma.pathEnrollment.findMany({
				where: { pathId: parent.pathId },
				select: { userId: true },
			});
			return rows.map((r) => r.userId);
		}
		if (parent.courseId) {
			const rows = await this.prisma.courseEnrollment.findMany({
				where: { courseId: parent.courseId },
				select: { userId: true },
			});
			return rows.map((r) => r.userId);
		}
		return [];
	}

	/** One learner's failure must not stop the sweep. */
	private async safeNotify(
		userId: string,
		input: Parameters<NotificationsService["notify"]>[1],
	): Promise<void> {
		try {
			await this.notifications.notify(userId, input);
		} catch (error) {
			this.logger.warn(
				`lifecycle notice failed for ${userId}: ${(error as Error).message}`,
			);
		}
	}
}
