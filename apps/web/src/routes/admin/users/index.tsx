import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	Ban,
	Copy,
	ExternalLink,
	LogOut,
	RotateCcw,
	Search,
	UsersRound,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { StudioShell } from "@/components/authoring/studio-shell";
import { type ActionItem, ActionMenu } from "@/components/ui/action-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
	type AdminUserRow,
	ASSIGNABLE_ROLES,
	type AssignableRole,
	adminUserKeys,
	listAdminUsers,
	restoreUser,
	setUserRole,
	signOutUserEverywhere,
	suspendUser,
} from "@/lib/admin-users-api";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/users/")({
	component: AdminUsersPage,
});

const ROLE_FILTERS = ["", ...ASSIGNABLE_ROLES, "facilitator"] as const;

function AdminUsersPage() {
	const { t } = useTranslation("authoring");
	const qc = useQueryClient();
	const { data: session } = useSession();
	const meId = session?.user?.id;

	const [search, setSearch] = useState("");
	const [role, setRole] = useState("");
	const [status, setStatus] = useState<"" | "active" | "suspended">("");
	const [page, setPage] = useState(1);
	const [suspending, setSuspending] = useState<AdminUserRow | null>(null);
	const [reason, setReason] = useState("");

	const query = {
		search: search.trim() || undefined,
		role: role || undefined,
		status: status || undefined,
		page,
	};
	const { data, isPending } = useQuery({
		queryKey: adminUserKeys.list(query),
		queryFn: () => listAdminUsers(query),
	});

	const invalidate = () =>
		qc.invalidateQueries({ queryKey: ["admin", "users"] });

	/** Every write reports the server's reason — the guardrails are the point. */
	const onError = (e: Error) => toast.error(e.message);

	const changeRole = useMutation({
		mutationFn: ({ id, next }: { id: string; next: AssignableRole }) =>
			setUserRole(id, next),
		onSuccess: (row) => {
			toast.success(
				t("admin_users.role_changed", {
					defaultValue: "{{name}} is now {{role}}",
					name: row.name,
					role: row.role,
				}),
			);
			invalidate();
		},
		onError,
	});

	const suspend = useMutation({
		mutationFn: ({ id, why }: { id: string; why: string }) =>
			suspendUser(id, why.trim() || undefined),
		onSuccess: (row) => {
			toast.success(
				t("admin_users.suspended_toast", {
					defaultValue: "{{name}} is suspended and signed out",
					name: row.name,
				}),
			);
			setSuspending(null);
			setReason("");
			invalidate();
		},
		onError,
	});

	const restore = useMutation({
		// Wrapped, not passed bare: TanStack calls mutationFn with (vars, context),
		// and a bare api fn would silently receive that context as its 2nd arg.
		mutationFn: (id: string) => restoreUser(id),
		onSuccess: (row) => {
			toast.success(
				t("admin_users.restored_toast", {
					defaultValue: "{{name}} can sign in again",
					name: row.name,
				}),
			);
			invalidate();
		},
		onError,
	});

	const signOut = useMutation({
		mutationFn: ({ id }: { id: string; name: string }) =>
			signOutUserEverywhere(id),
		// Report what actually happened: "signed out" when they had no live
		// session at all would be a small lie the admin can't check.
		onSuccess: ({ revoked }, { name }) => {
			toast.success(
				revoked > 0
					? t("admin_users.signed_out_toast", {
							defaultValue: "Signed {{name}} out of {{count}} session(s)",
							name,
							count: revoked,
						})
					: t("admin_users.no_sessions_toast", {
							defaultValue: "{{name}} had no active sessions",
							name,
						}),
			);
		},
		onError,
	});

	const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

	return (
		<StudioShell
			title={t("admin_users.title", { defaultValue: "Users" })}
			area="admin"
		>
			<div className="space-y-5">
				<div>
					<h2 className="font-display text-2xl text-foreground sm:text-3xl">
						{t("admin_users.title", { defaultValue: "Users" })}
					</h2>
					<p className="mt-1 text-muted-foreground">
						{t("admin_users.subtitle", {
							defaultValue:
								"Everyone on the platform. Change what someone can do, or suspend access.",
						})}
					</p>
				</div>

				{/* Filters: one row, above the data. */}
				<div className="space-y-3">
					<label className="relative block">
						<Search className="-translate-y-1/2 absolute top-1/2 left-3.5 size-4 text-muted-foreground" />
						<input
							type="search"
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								setPage(1);
							}}
							placeholder={t("admin_users.search_ph", {
								defaultValue: "Search by name or email…",
							})}
							aria-label={t("admin_users.search_ph", {
								defaultValue: "Search by name or email…",
							})}
							className="h-11 w-full rounded-input border border-border bg-card pl-10 pr-4 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-primary"
						/>
					</label>

					{/* Horizontal scroll rather than wrap: keeps the filter row one
					    line on a phone without shrinking the tap targets. */}
					<div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
						{ROLE_FILTERS.map((r) => (
							<Chip
								key={r || "all"}
								active={role === r}
								onClick={() => {
									setRole(r);
									setPage(1);
								}}
								count={r ? data?.roleCounts[r] : data?.total}
							>
								{r
									? t(`admin_users.role_${r}`, { defaultValue: r })
									: t("admin_users.all", { defaultValue: "All" })}
							</Chip>
						))}
						<span className="mx-1 w-px shrink-0 bg-border" />
						<Chip
							active={status === "suspended"}
							onClick={() => {
								setStatus(status === "suspended" ? "" : "suspended");
								setPage(1);
							}}
						>
							{t("admin_users.suspended", { defaultValue: "Suspended" })}
						</Chip>
					</div>
				</div>

				{isPending ? (
					<div className="space-y-2">
						<Skeleton className="h-16 rounded-card" />
						<Skeleton className="h-16 rounded-card" />
						<Skeleton className="h-16 rounded-card" />
					</div>
				) : !data || data.rows.length === 0 ? (
					<section className="rounded-card border border-border bg-card px-5 py-14 text-center shadow-card">
						<UsersRound className="mx-auto size-8 text-muted-foreground" />
						<p className="mt-3 font-display text-foreground">
							{t("admin_users.empty", { defaultValue: "No users match" })}
						</p>
					</section>
				) : (
					<UserList
						rows={data.rows}
						meId={meId}
						onRole={(id, next) => changeRole.mutate({ id, next })}
						onSuspend={setSuspending}
						onRestore={(id) => restore.mutate(id)}
						onSignOut={(u) => signOut.mutate({ id: u.id, name: u.name })}
						busy={
							changeRole.isPending || restore.isPending || signOut.isPending
						}
					/>
				)}

				{totalPages > 1 ? (
					<div className="flex items-center justify-between gap-3">
						<p className="text-muted-foreground text-sm">
							{t("admin_users.page_of", {
								defaultValue: "Page {{page}} of {{total}}",
								page: data?.page ?? 1,
								total: totalPages,
							})}
						</p>
						<div className="flex gap-2">
							<PageBtn
								disabled={(data?.page ?? 1) <= 1}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
							>
								{t("admin_users.prev", { defaultValue: "Previous" })}
							</PageBtn>
							<PageBtn
								disabled={(data?.page ?? 1) >= totalPages}
								onClick={() => setPage((p) => p + 1)}
							>
								{t("admin_users.next", { defaultValue: "Next" })}
							</PageBtn>
						</div>
					</div>
				) : null}
			</div>

			<ConfirmDialog
				open={Boolean(suspending)}
				title={t("admin_users.suspend_title", {
					defaultValue: "Suspend {{name}}?",
					name: suspending?.name ?? "",
				})}
				description={t("admin_users.suspend_desc", {
					defaultValue:
						"They'll be signed out and refused on every request until you restore them. Their content, enrolments and any money owed are untouched.",
				})}
				confirmLabel={t("admin_users.suspend_confirm", {
					defaultValue: "Suspend",
				})}
				cancelLabel={t("admin_users.cancel", { defaultValue: "Cancel" })}
				tone="danger"
				isPending={suspend.isPending}
				onOpenChange={(open) => {
					if (!open) {
						setSuspending(null);
						setReason("");
					}
				}}
				onConfirm={() =>
					suspending && suspend.mutate({ id: suspending.id, why: reason })
				}
			>
				{/* The reason is shown to them on every refused request — without it
				    they only see a wall, and support gets the ticket. */}
				<label className="block">
					<span className="mb-1.5 block font-medium text-foreground text-sm">
						{t("admin_users.reason", {
							defaultValue: "Reason (they'll see this)",
						})}
					</span>
					<textarea
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						maxLength={500}
						rows={3}
						placeholder={t("admin_users.reason_ph", {
							defaultValue: "e.g. Repeated spam in cohort chat",
						})}
						className="w-full resize-none rounded-input border border-border bg-card px-3 py-2 text-foreground text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-primary"
					/>
				</label>
			</ConfirmDialog>
		</StudioShell>
	);
}

function Chip({
	active,
	count,
	onClick,
	children,
}: {
	active: boolean;
	count?: number;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={cn(
				"inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border px-3.5 font-medium text-sm transition-colors",
				active
					? "border-brand-primary bg-brand-solid text-white"
					: "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
			)}
		>
			{children}
			{typeof count === "number" ? (
				<span className={cn("tabular-nums", active ? "opacity-80" : "")}>
					{count}
				</span>
			) : null}
		</button>
	);
}

function PageBtn({
	disabled,
	onClick,
	children,
}: {
	disabled: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			className="h-9 rounded-btn border border-border bg-card px-3 font-medium text-foreground text-sm transition-colors hover:bg-accent disabled:opacity-40"
		>
			{children}
		</button>
	);
}

/** Desktop: a table. Mobile: the same rows as cards. */
function UserList({
	rows,
	meId,
	onRole,
	onSuspend,
	onRestore,
	onSignOut,
	busy,
}: {
	rows: AdminUserRow[];
	meId?: string;
	onRole: (id: string, next: AssignableRole) => void;
	onSuspend: (row: AdminUserRow) => void;
	onRestore: (id: string) => void;
	onSignOut: (row: AdminUserRow) => void;
	busy: boolean;
}) {
	const { t } = useTranslation("authoring");

	return (
		<section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
			<div className="hidden overflow-x-auto sm:block">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-border border-b bg-muted/50 text-left text-muted-foreground text-xs">
							<th className="px-5 py-2.5 font-medium">
								{t("admin_users.col_user", { defaultValue: "User" })}
							</th>
							<th className="px-3 py-2.5 font-medium">
								{t("admin_users.col_role", { defaultValue: "Role" })}
							</th>
							<th className="px-3 py-2.5 text-right font-medium">
								{t("admin_users.col_activity", { defaultValue: "Activity" })}
							</th>
							<th className="px-5 py-2.5 text-right font-medium">
								{t("admin_users.col_actions", { defaultValue: "Actions" })}
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{rows.map((u) => (
							<tr key={u.id} className={cn(u.suspendedAt && "bg-muted/30")}>
								<td className="px-5 py-3">
									<Identity row={u} isMe={u.id === meId} />
								</td>
								<td className="px-3 py-3">
									<RoleSelect row={u} isMe={u.id === meId} onRole={onRole} />
								</td>
								<td className="px-3 py-3 text-right text-muted-foreground text-xs">
									<Activity row={u} />
								</td>
								<td className="px-5 py-3 text-right">
									<div className="flex justify-end">
										<Actions
											row={u}
											isMe={u.id === meId}
											busy={busy}
											onSuspend={onSuspend}
											onRestore={onRestore}
											onSignOut={onSignOut}
										/>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<ul className="divide-y divide-border sm:hidden">
				{rows.map((u) => (
					<li
						key={u.id}
						className={cn("space-y-3 p-4", u.suspendedAt && "bg-muted/30")}
					>
						<Identity row={u} isMe={u.id === meId} />
						<p className="text-muted-foreground text-xs">
							<Activity row={u} />
						</p>
						<div className="flex items-center justify-between gap-2">
							<RoleSelect row={u} isMe={u.id === meId} onRole={onRole} />
							<Actions
								row={u}
								isMe={u.id === meId}
								busy={busy}
								onSuspend={onSuspend}
								onRestore={onRestore}
								onSignOut={onSignOut}
							/>
						</div>
					</li>
				))}
			</ul>
		</section>
	);
}

function Identity({ row, isMe }: { row: AdminUserRow; isMe: boolean }) {
	const { t } = useTranslation("authoring");
	return (
		<div className="flex min-w-0 items-center gap-3">
			{row.image ? (
				<img
					src={row.image}
					alt=""
					className="size-9 shrink-0 rounded-full object-cover"
				/>
			) : (
				<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-primary-light font-semibold text-brand-primary text-xs">
					{row.name.slice(0, 2).toUpperCase()}
				</span>
			)}
			<div className="min-w-0">
				<p className="flex items-center gap-1.5 truncate font-medium text-foreground">
					{row.name}
					{isMe ? (
						<span className="shrink-0 rounded-pill bg-muted px-1.5 py-0.5 font-medium text-[0.6rem] text-muted-foreground uppercase">
							{t("admin_users.you", { defaultValue: "You" })}
						</span>
					) : null}
				</p>
				<p className="truncate text-muted-foreground text-xs">{row.email}</p>
				{row.suspendedAt ? (
					<p className="mt-1 flex items-center gap-1 text-destructive text-xs">
						<Ban className="size-3 shrink-0" />
						{row.suspendedReason
							? t("admin_users.suspended_for", {
									defaultValue: "Suspended — {{reason}}",
									reason: row.suspendedReason,
								})
							: t("admin_users.suspended", { defaultValue: "Suspended" })}
					</p>
				) : null}
			</div>
		</div>
	);
}

function Activity({ row }: { row: AdminUserRow }) {
	const { t, i18n } = useTranslation("authoring");
	return (
		<>
			{row.createdCount > 0
				? t("admin_users.created_n", {
						defaultValue: "{{count}} published",
						count: row.createdCount,
					})
				: t("admin_users.enrolled_n", {
						defaultValue: "{{count}} enrolments",
						count: row.enrolmentCount,
					})}
			{" · "}
			{t("admin_users.joined", {
				defaultValue: "joined {{date}}",
				date: new Date(row.joinedAt).toLocaleDateString(i18n.language, {
					month: "short",
					year: "numeric",
				}),
			})}
		</>
	);
}

function RoleSelect({
	row,
	isMe,
	onRole,
}: {
	row: AdminUserRow;
	isMe: boolean;
	onRole: (id: string, next: AssignableRole) => void;
}) {
	const { t } = useTranslation("authoring");
	// facilitator is per-cohort (§4.7) — it can appear here but never be chosen,
	// so the select shows the truth without implying it's globally grantable.
	const isFacilitator = row.role === "facilitator";
	return (
		<select
			value={row.role}
			disabled={isMe || isFacilitator}
			aria-label={t("admin_users.col_role", { defaultValue: "Role" })}
			onChange={(e) => onRole(row.id, e.target.value as AssignableRole)}
			title={
				isMe
					? t("admin_users.no_self_role", {
							defaultValue: "You can't change your own role.",
						})
					: isFacilitator
						? t("admin_users.facilitator_hint", {
								defaultValue: "Facilitation is assigned per cohort.",
							})
						: undefined
			}
			className="h-9 cursor-pointer rounded-input border border-border bg-card px-2.5 text-foreground text-sm outline-none transition-colors focus:border-brand-primary disabled:cursor-not-allowed disabled:opacity-60"
		>
			{isFacilitator ? (
				<option value="facilitator">
					{t("admin_users.role_facilitator", { defaultValue: "facilitator" })}
				</option>
			) : null}
			{ASSIGNABLE_ROLES.map((r) => (
				<option key={r} value={r}>
					{t(`admin_users.role_${r}`, { defaultValue: r })}
				</option>
			))}
		</select>
	);
}

/**
 * Row overflow menu. Harmless items (copy, view) stay available on your own
 * row; the ones that act on access are omitted for yourself, matching the
 * server's refusal rather than offering a button that always 400s.
 */
function Actions({
	row,
	isMe,
	busy,
	onSuspend,
	onRestore,
	onSignOut,
}: {
	row: AdminUserRow;
	isMe: boolean;
	busy: boolean;
	onSuspend: (row: AdminUserRow) => void;
	onRestore: (id: string) => void;
	onSignOut: (row: AdminUserRow) => void;
}) {
	const { t } = useTranslation("authoring");

	const items: ActionItem[] = [
		{
			key: "copy",
			label: t("admin_users.copy_email", { defaultValue: "Copy email" }),
			icon: Copy,
			onSelect: () => {
				navigator.clipboard
					.writeText(row.email)
					.then(() =>
						toast.success(
							t("admin_users.email_copied", { defaultValue: "Email copied" }),
						),
					)
					// Clipboard access can be denied outright — don't claim success.
					.catch(() =>
						toast.error(
							t("admin_users.copy_failed", {
								defaultValue: "Couldn't copy — copy it manually",
							}),
						),
					);
			},
		},
	];

	// Only instructors have a public page; a learner link would 404.
	if (row.role === "instructor") {
		items.push({
			key: "profile",
			label: t("admin_users.view_profile", {
				defaultValue: "View public profile",
			}),
			icon: ExternalLink,
			onSelect: () => window.open(`/instructors/${row.id}`, "_blank"),
		});
	}

	if (!isMe) {
		if (!row.suspendedAt) {
			items.push({
				key: "signout",
				label: t("admin_users.sign_out", {
					defaultValue: "Sign out everywhere",
				}),
				icon: LogOut,
				disabled: busy,
				onSelect: () => onSignOut(row),
			});
		}
		items.push(
			row.suspendedAt
				? {
						key: "restore",
						label: t("admin_users.restore", { defaultValue: "Restore" }),
						icon: RotateCcw,
						disabled: busy,
						onSelect: () => onRestore(row.id),
					}
				: {
						key: "suspend",
						label: t("admin_users.suspend", { defaultValue: "Suspend" }),
						icon: Ban,
						tone: "danger",
						disabled: busy,
						onSelect: () => onSuspend(row),
					},
		);
	}

	return (
		<ActionMenu
			items={items}
			label={t("admin_users.actions_for", {
				defaultValue: "Actions for {{name}}",
				name: row.name,
			})}
		/>
	);
}
