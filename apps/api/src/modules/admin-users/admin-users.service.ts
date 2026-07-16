import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";

/** The roles an Admin may assign. `facilitator` is per-cohort, not global. */
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
	/** Paid + free enrolments across courses/paths/cohorts. */
	enrolmentCount: number;
}

export interface AdminUserList {
	rows: AdminUserRow[];
	total: number;
	page: number;
	pageSize: number;
	/** Live counts per role for the filter chips (unaffected by the filter). */
	roleCounts: Record<string, number>;
}

/** One projection shared by the list and every single-row response. */
const USER_SELECT = {
	id: true,
	fullName: true,
	firstName: true,
	lastName: true,
	email: true,
	role: true,
	image: true,
	emailVerified: true,
	phoneVerified: true,
	suspendedAt: true,
	suspendedReason: true,
	createdAt: true,
	_count: {
		select: {
			createdCourses: true,
			createdLearningPaths: true,
			courseEnrollments: true,
			pathEnrollments: true,
			cohortEnrollments: true,
		},
	},
} as const;

type UserRecord = {
	id: string;
	fullName: string | null;
	firstName: string | null;
	lastName: string | null;
	email: string;
	role: string;
	image: string | null;
	emailVerified: boolean;
	phoneVerified: boolean;
	suspendedAt: Date | null;
	suspendedReason: string | null;
	createdAt: Date;
	_count: {
		createdCourses: number;
		createdLearningPaths: number;
		courseEnrollments: number;
		pathEnrollments: number;
		cohortEnrollments: number;
	};
};

function toRow(u: UserRecord): AdminUserRow {
	return {
		id: u.id,
		name:
			u.fullName?.trim() ||
			`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() ||
			u.email,
		email: u.email,
		role: u.role,
		image: u.image,
		emailVerified: u.emailVerified,
		phoneVerified: u.phoneVerified,
		suspendedAt: u.suspendedAt?.toISOString() ?? null,
		suspendedReason: u.suspendedReason,
		joinedAt: u.createdAt.toISOString(),
		createdCount: u._count.createdCourses + u._count.createdLearningPaths,
		enrolmentCount:
			u._count.courseEnrollments +
			u._count.pathEnrollments +
			u._count.cohortEnrollments,
	};
}

/**
 * Admin user management (§8.7). A thin read model over `users` plus three
 * privileged writes: change role, suspend, restore.
 *
 * Everything here is guarded by invariants rather than trust, because the
 * failure modes are severe and silent: an admin who demotes themselves is
 * locked out of the page that could undo it, and demoting the last admin locks
 * *everyone* out of admin permanently — recoverable only by hand-editing the
 * database. Those two are refused outright, not warned about.
 */
@Injectable()
export class AdminUsersService {
	private readonly logger = new Logger(AdminUsersService.name);

	constructor(private readonly prisma: PrismaService) {}

	async list(params: {
		search?: string;
		role?: string;
		status?: "active" | "suspended";
		page?: number;
		pageSize?: number;
	}): Promise<AdminUserList> {
		const page = Math.max(1, params.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
		const search = params.search?.trim();

		const where = {
			...(search
				? {
						OR: [
							{ email: { contains: search, mode: "insensitive" as const } },
							{ firstName: { contains: search, mode: "insensitive" as const } },
							{ lastName: { contains: search, mode: "insensitive" as const } },
							{ fullName: { contains: search, mode: "insensitive" as const } },
						],
					}
				: {}),
			...(params.role ? { role: params.role as AssignableRole } : {}),
			...(params.status === "suspended"
				? { suspendedAt: { not: null } }
				: params.status === "active"
					? { suspendedAt: null }
					: {}),
		};

		const [rows, total, grouped] = await Promise.all([
			this.prisma.user.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip: (page - 1) * pageSize,
				take: pageSize,
				select: USER_SELECT,
			}),
			this.prisma.user.count({ where }),
			this.prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
		]);

		return {
			rows: rows.map(toRow),
			total,
			page,
			pageSize,
			roleCounts: Object.fromEntries(
				grouped.map((g) => [g.role, g._count._all]),
			),
		};
	}

	/** Admins currently able to sign in — a suspended admin can't undo anything. */
	private activeAdminCount(excludingUserId?: string): Promise<number> {
		return this.prisma.user.count({
			where: {
				role: "admin",
				suspendedAt: null,
				...(excludingUserId ? { id: { not: excludingUserId } } : {}),
			},
		});
	}

	private async load(userId: string) {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { id: true, role: true, email: true, suspendedAt: true },
		});
		if (!user) throw new NotFoundException("User not found");
		return user;
	}

	/**
	 * Change a user's global role. Refuses the two irreversible mistakes: an
	 * admin demoting themselves, and removing the last admin who can still sign
	 * in. `facilitator` is not assignable here — it's a per-cohort assignment
	 * (§4.7), and granting it globally would misrepresent how it works.
	 */
	async setRole(
		actor: AuthenticatedUser,
		userId: string,
		role: AssignableRole,
	): Promise<AdminUserRow> {
		if (!ASSIGNABLE_ROLES.includes(role)) {
			throw new BadRequestException("Unknown role");
		}
		const target = await this.load(userId);
		if (target.role === role) return this.rowFor(userId);

		if (target.id === actor.id) {
			throw new ForbiddenException(
				"You can't change your own role — ask another admin.",
			);
		}
		if (target.role === "admin" && role !== "admin") {
			// Excluding the target: are there other admins left who can sign in?
			if ((await this.activeAdminCount(target.id)) === 0) {
				throw new BadRequestException(
					"This is the last active admin — promote someone else first.",
				);
			}
		}

		await this.prisma.user.update({ where: { id: userId }, data: { role } });
		this.logger.warn(
			`Role change by ${actor.email}: ${target.email} ${target.role} → ${role}`,
		);
		return this.rowFor(userId);
	}

	/**
	 * Suspend a user: they're refused on every authenticated request, and their
	 * sessions are revoked so it takes effect now rather than whenever their
	 * cookie happens to expire.
	 *
	 * Their content, enrolments, orders and payouts are deliberately untouched —
	 * suspension is an access decision, not a financial one. Money already owed
	 * still settles; §14.3 payouts are driven by `instructor_payouts` rows, which
	 * never consult a user's role or status.
	 */
	async suspend(
		actor: AuthenticatedUser,
		userId: string,
		reason?: string,
	): Promise<AdminUserRow> {
		const target = await this.load(userId);
		if (target.id === actor.id) {
			throw new ForbiddenException("You can't suspend yourself.");
		}
		if (
			target.role === "admin" &&
			(await this.activeAdminCount(target.id)) === 0
		) {
			throw new BadRequestException(
				"This is the last active admin — promote someone else first.",
			);
		}
		if (target.suspendedAt) return this.rowFor(userId);

		await this.prisma.$transaction([
			this.prisma.user.update({
				where: { id: userId },
				data: {
					suspendedAt: new Date(),
					suspendedReason: reason?.trim() || null,
				},
			}),
			// Without this they stay signed in until their cookie expires.
			this.prisma.session.deleteMany({ where: { userId } }),
		]);
		this.logger.warn(
			`User suspended by ${actor.email}: ${target.email}${reason ? ` — ${reason}` : ""}`,
		);
		return this.rowFor(userId);
	}

	/** Lift a suspension. They must sign in again — sessions were revoked. */
	async restore(
		actor: AuthenticatedUser,
		userId: string,
	): Promise<AdminUserRow> {
		const target = await this.load(userId);
		if (!target.suspendedAt) return this.rowFor(userId);
		await this.prisma.user.update({
			where: { id: userId },
			data: { suspendedAt: null, suspendedReason: null },
		});
		this.logger.warn(`User restored by ${actor.email}: ${target.email}`);
		return this.rowFor(userId);
	}

	/**
	 * Revoke every session without suspending — the remedy for "my account may
	 * be compromised", which is help, not punishment. Deliberately separate from
	 * `suspend`: that one also bars them from signing back in, which is exactly
	 * what a user with a stolen laptop does NOT want.
	 */
	async signOutEverywhere(
		actor: AuthenticatedUser,
		userId: string,
	): Promise<{ revoked: number }> {
		const target = await this.load(userId);
		const { count } = await this.prisma.session.deleteMany({
			where: { userId },
		});
		this.logger.warn(
			`Sessions revoked by ${actor.email}: ${target.email} (${count})`,
		);
		return { revoked: count };
	}

	/** Re-read one row through the same projection the list uses. */
	private async rowFor(userId: string): Promise<AdminUserRow> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: USER_SELECT,
		});
		if (!user) throw new NotFoundException("User not found");
		return toRow(user);
	}
}
