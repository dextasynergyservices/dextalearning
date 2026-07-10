import {
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	TouchSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
	ArrowRightLeft,
	Check,
	Crown,
	GripVertical,
	Info,
	Loader2,
	Pencil,
	Plus,
	Shuffle,
	Trash2,
	Users,
	X,
} from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
	assignLearner,
	type CohortGroup,
	createGroup,
	deleteGroup,
	type GroupMember,
	generateGroups,
	getGroupingBoard,
	renameGroup,
	setGroupLead,
} from "@/lib/grouping-api";
import { cn } from "@/lib/utils";

/** Where a learner can be dropped: a group id, or the unassigned pool. */
type Destination = string | null;

const UNASSIGNED = "__unassigned__";

/** The learner whose single-move sheet is open, plus the group they're in. */
interface MoveTarget {
	member: GroupMember;
	from: string | null;
}

function initials(name: string): string {
	return (
		name
			.split(/\s+/)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase() ?? "")
			.join("") || "?"
	);
}

/**
 * Admin/facilitator group-management board (§4.7). Two clear ways to build
 * groups, both mobile-native:
 *  1. **Pick learners → form a group.** Select unassigned learners (tap), then
 *     "New group with N" or "Add to group" — the flow that matches "pick
 *     learners to form a group".
 *  2. **Drag & drop** a single learner into a group (desktop) or **Move** them
 *     via a bottom sheet (any device).
 * Plus "Generate groups" for the configured auto-grouping. An adaptive banner
 * tells the admin exactly what to do for the current state.
 */
export function GroupBoard({ cohortId }: { cohortId: string }) {
	const { t } = useTranslation("authoring");
	const queryClient = useQueryClient();
	const [regenOpen, setRegenOpen] = useState(false);
	const [dragging, setDragging] = useState<GroupMember | null>(null);
	const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [pickerOpen, setPickerOpen] = useState(false);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(TouchSensor, {
			activationConstraint: { delay: 150, tolerance: 8 },
		}),
		useSensor(KeyboardSensor),
	);

	const queryKey = ["grouping", cohortId];
	const { data, isPending } = useQuery({
		queryKey,
		queryFn: () => getGroupingBoard(cohortId),
	});
	const invalidate = () => queryClient.invalidateQueries({ queryKey });

	const generate = useMutation({
		mutationFn: () => generateGroups(cohortId),
		onSuccess: (board) => {
			queryClient.setQueryData(queryKey, board);
			toast.success(
				t("grouping.generated", { defaultValue: "Groups generated" }),
			);
		},
		onError: (e) => toast.error(e.message),
	});

	const move = useMutation({
		mutationFn: ({ userId, to }: { userId: string; to: Destination }) =>
			assignLearner(cohortId, userId, to),
		onSuccess: invalidate,
		onError: (e) => toast.error(e.message),
	});

	const lead = useMutation({
		mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
			setGroupLead(cohortId, groupId, userId),
		onSuccess: invalidate,
		onError: (e) => toast.error(e.message),
	});

	const addGroup = useMutation({
		mutationFn: () => createGroup(cohortId),
		onSuccess: invalidate,
		onError: (e) => toast.error(e.message),
	});

	// Assign every selected learner to an existing group, or to a brand-new one.
	const assignSelected = useMutation({
		mutationFn: async (to: Destination | "new") => {
			const ids = [...selected];
			const target: string =
				to === "new" ? (await createGroup(cohortId)).id : (to as string);
			for (const userId of ids) {
				await assignLearner(cohortId, userId, target);
			}
		},
		onSuccess: () => {
			invalidate();
			setSelected(new Set());
			setPickerOpen(false);
		},
		onError: (e) => toast.error(e.message),
	});

	if (isPending || !data) {
		return <Skeleton className="h-64 rounded-card" />;
	}

	const hasGroups = data.groups.length > 0;
	const assignedCount = data.groups.reduce((n, g) => n + g.members.length, 0);
	const totalLearners = assignedCount + data.unassigned.length;

	const toggleSelect = (userId: string) =>
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(userId)) next.delete(userId);
			else next.add(userId);
			return next;
		});

	const onDragStart = (event: DragStartEvent) => {
		setDragging((event.active.data.current?.member as GroupMember) ?? null);
	};
	const onDragEnd = (event: DragEndEvent) => {
		setDragging(null);
		const { active, over } = event;
		if (!over) return;
		const to = over.id === UNASSIGNED ? null : String(over.id);
		const from = (active.data.current?.from as Destination) ?? null;
		if (from === to) return;
		move.mutate({ userId: String(active.id), to });
	};

	// Guidance that adapts to what the admin should do next.
	const guidance =
		totalLearners === 0
			? t("grouping.banner_no_learners", {
					defaultValue: "No learners have enrolled in this cohort yet.",
				})
			: data.unassigned.length > 0
				? t("grouping.banner_assign", {
						defaultValue:
							"Select learners below to form a group, or drag one into a group. On mobile, tap Move.",
					})
				: t("grouping.banner_done", {
						defaultValue:
							"Every learner is in a group. Use Move to reshuffle anyone.",
					});

	return (
		<section className="rounded-card border border-border bg-card shadow-card">
			<header className="flex flex-col gap-3 border-border border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
				<div>
					<h2 className="font-display text-foreground text-lg">
						{t("grouping.title", { defaultValue: "Groups" })}
					</h2>
					<p className="mt-0.5 text-muted-foreground text-sm">
						{t(`grouping.mode_${data.cohort.groupingMode}_hint`, {
							defaultValue: modeHint(data.cohort.groupingMode),
						})}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						className="flex-1 sm:flex-none"
						onClick={() => addGroup.mutate()}
						disabled={addGroup.isPending}
					>
						<Plus className="size-4" />
						{t("grouping.new_group", { defaultValue: "New group" })}
					</Button>
					<Button
						size="sm"
						className="flex-1 sm:flex-none"
						onClick={() => (hasGroups ? setRegenOpen(true) : generate.mutate())}
						disabled={generate.isPending}
					>
						{generate.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Shuffle className="size-4" />
						)}
						{hasGroups
							? t("grouping.regenerate", { defaultValue: "Re-group" })
							: t("grouping.generate", { defaultValue: "Generate groups" })}
					</Button>
				</div>
			</header>

			<div className="flex items-start gap-2 border-border border-b bg-muted/40 px-4 py-2.5 text-muted-foreground text-xs sm:px-6">
				<Info className="mt-0.5 size-3.5 shrink-0 text-brand-primary" />
				<p>{guidance}</p>
			</div>

			<DndContext
				sensors={sensors}
				onDragStart={onDragStart}
				onDragEnd={onDragEnd}
			>
				<div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
					{data.groups.map((group) => (
						<GroupColumn
							key={group.id}
							cohortId={cohortId}
							group={group}
							target={data.cohort.targetGroupSize}
							onRequestMove={setMoveTarget}
							onChanged={invalidate}
						/>
					))}
				</div>

				<UnassignedPool
					learners={data.unassigned}
					totalLearners={totalLearners}
					selected={selected}
					onToggleSelect={toggleSelect}
				/>

				<DragOverlay>
					{dragging ? (
						<div className="flex items-center gap-2 rounded-btn border border-brand-primary bg-card px-2 py-1.5 shadow-card-hover">
							<span className="flex size-7 items-center justify-center rounded-full bg-brand-primary-light font-semibold text-[0.65rem] text-brand-primary">
								{initials(dragging.name)}
							</span>
							<span className="text-foreground text-sm">{dragging.name}</span>
						</div>
					) : null}
				</DragOverlay>
			</DndContext>

			{/* Selection action bar — "pick learners to form a group". */}
			<AnimatePresence>
				{selected.size > 0 ? (
					<motion.div
						initial={{ y: 12, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						exit={{ y: 12, opacity: 0 }}
						className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-border border-t bg-card/95 px-4 py-3 backdrop-blur sm:px-6"
					>
						<span className="font-medium text-foreground text-sm">
							{t("grouping.selected_count", {
								count: selected.size,
								defaultValue: "{{count}} selected",
							})}
						</span>
						<div className="flex flex-1 flex-wrap items-center justify-end gap-2">
							<Button
								size="sm"
								onClick={() => assignSelected.mutate("new")}
								disabled={assignSelected.isPending}
							>
								{assignSelected.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<Plus className="size-4" />
								)}
								{t("grouping.new_group_with", {
									count: selected.size,
									defaultValue: "New group with {{count}}",
								})}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setPickerOpen(true)}
								disabled={!hasGroups || assignSelected.isPending}
							>
								{t("grouping.add_to_group", { defaultValue: "Add to group" })}
							</Button>
							<button
								type="button"
								onClick={() => setSelected(new Set())}
								className="rounded-btn px-2 py-1 text-muted-foreground text-sm hover:text-foreground"
							>
								{t("grouping.clear", { defaultValue: "Clear" })}
							</button>
						</div>
					</motion.div>
				) : null}
			</AnimatePresence>

			<MoveSheet
				target={moveTarget}
				groups={data.groups}
				onClose={() => setMoveTarget(null)}
				onMove={(to) => {
					if (moveTarget) move.mutate({ userId: moveTarget.member.userId, to });
					setMoveTarget(null);
				}}
				onNewGroup={() => {
					if (moveTarget) {
						const userId = moveTarget.member.userId;
						setMoveTarget(null);
						setSelected(new Set([userId]));
						assignSelected.mutate("new");
					}
				}}
				onSetLead={() => {
					if (moveTarget?.from) {
						lead.mutate({
							groupId: moveTarget.from,
							userId: moveTarget.member.userId,
						});
					}
					setMoveTarget(null);
				}}
			/>

			<PickerSheet
				open={pickerOpen}
				groups={data.groups}
				count={selected.size}
				onClose={() => setPickerOpen(false)}
				onPick={(groupId) => assignSelected.mutate(groupId)}
			/>

			<ConfirmDialog
				open={regenOpen}
				title={t("grouping.regen_title", {
					defaultValue: "Re-group everyone?",
				})}
				description={t("grouping.regen_desc", {
					defaultValue:
						"This rebuilds every group from the cohort's grouping mode. Learners whose group changes are notified.",
				})}
				confirmLabel={t("grouping.regenerate", { defaultValue: "Re-group" })}
				cancelLabel={t("editor.cancel", { defaultValue: "Cancel" })}
				isPending={generate.isPending}
				onOpenChange={setRegenOpen}
				onConfirm={() => {
					generate.mutate();
					setRegenOpen(false);
				}}
			/>
		</section>
	);
}

function modeHint(mode: string): string {
	switch (mode) {
		case "manual":
			return "Build groups by hand — pick learners or drag them in.";
		case "skill_based":
			return "Auto-grouping mixes skill levels evenly.";
		case "balanced":
			return "Auto-grouping balances level and join date.";
		default:
			return "Auto-grouping shuffles learners randomly.";
	}
}

function GroupColumn({
	cohortId,
	group,
	target,
	onRequestMove,
	onChanged,
}: {
	cohortId: string;
	group: CohortGroup;
	target: number;
	onRequestMove: (target: MoveTarget) => void;
	onChanged: () => void;
}) {
	const { t } = useTranslation("authoring");
	const { setNodeRef, isOver } = useDroppable({ id: group.id });
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState(group.name ?? "");
	const [confirmDelete, setConfirmDelete] = useState(false);

	const rename = useMutation({
		mutationFn: (value: string) => renameGroup(cohortId, group.id, value),
		onSuccess: onChanged,
		onError: (e) => toast.error(e.message),
	});
	const remove = useMutation({
		mutationFn: () => deleteGroup(cohortId, group.id),
		onSuccess: onChanged,
		onError: (e) => toast.error(e.message),
	});

	const label = group.name ?? t("grouping.untitled", { defaultValue: "Group" });
	const full = group.members.length >= target;

	return (
		<div
			ref={setNodeRef}
			data-testid="group-column"
			className={cn(
				"flex flex-col rounded-card border bg-muted/30 transition-colors",
				isOver
					? "border-brand-primary bg-brand-primary-light/40"
					: "border-border",
			)}
		>
			<div className="flex items-center gap-2 border-border border-b px-3 py-2">
				<Users className="size-4 shrink-0 text-brand-primary" />
				{editing ? (
					<input
						value={name}
						// biome-ignore lint/a11y/noAutofocus: focusing the rename field the instant the admin opens it is the expected inline-edit UX.
						autoFocus
						onChange={(e) => setName(e.target.value)}
						onBlur={() => {
							setEditing(false);
							if (name.trim() && name.trim() !== group.name)
								rename.mutate(name.trim());
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter") e.currentTarget.blur();
							if (e.key === "Escape") {
								setName(group.name ?? "");
								setEditing(false);
							}
						}}
						className="h-7 min-w-0 flex-1 rounded border border-border bg-card px-2 text-foreground text-sm outline-none focus:border-brand-primary"
					/>
				) : (
					<button
						type="button"
						onClick={() => setEditing(true)}
						className="group flex min-w-0 flex-1 items-center gap-1.5 text-left"
					>
						<span className="truncate font-display text-foreground text-sm">
							{label}
						</span>
						<Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
					</button>
				)}
				<span
					className={cn(
						"shrink-0 rounded-pill px-2 py-0.5 font-stats text-[0.65rem]",
						full
							? "bg-success/10 text-success"
							: "bg-muted text-muted-foreground",
					)}
				>
					{group.members.length}/{target}
				</span>
				<button
					type="button"
					aria-label={t("grouping.delete_group", {
						defaultValue: "Delete group",
					})}
					onClick={() => setConfirmDelete(true)}
					className="flex size-7 shrink-0 items-center justify-center rounded-btn text-muted-foreground hover:bg-error/5 hover:text-error"
				>
					<Trash2 className="size-3.5" />
				</button>
			</div>

			<div className="flex flex-1 flex-col gap-1.5 p-2.5">
				{group.members.length === 0 ? (
					<p className="px-1 py-6 text-center text-muted-foreground text-xs">
						{t("grouping.drop_here", {
							defaultValue: "Drop learners here, or use Move",
						})}
					</p>
				) : (
					group.members.map((member) => (
						<MemberChip
							key={member.userId}
							member={member}
							currentGroupId={group.id}
							onRequestMove={onRequestMove}
						/>
					))
				)}
			</div>

			<ConfirmDialog
				open={confirmDelete}
				title={t("grouping.delete_group_title", {
					defaultValue: "Delete this group?",
				})}
				description={t("grouping.delete_group_desc", {
					defaultValue: "Its members return to the unassigned pool.",
				})}
				confirmLabel={t("editor.delete", { defaultValue: "Delete" })}
				cancelLabel={t("editor.cancel", { defaultValue: "Cancel" })}
				isPending={remove.isPending}
				tone="danger"
				onOpenChange={setConfirmDelete}
				onConfirm={() => {
					remove.mutate();
					setConfirmDelete(false);
				}}
			/>
		</div>
	);
}

function UnassignedPool({
	learners,
	totalLearners,
	selected,
	onToggleSelect,
}: {
	learners: { userId: string; name: string; skillLevel: string | null }[];
	totalLearners: number;
	selected: Set<string>;
	onToggleSelect: (userId: string) => void;
}) {
	const { t } = useTranslation("authoring");
	const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED });

	return (
		<div className="border-border border-t px-4 py-4 sm:px-6">
			<div className="mb-2 flex items-center gap-2">
				<h3 className="font-display text-foreground text-sm">
					{t("grouping.unassigned", { defaultValue: "Unassigned" })}
				</h3>
				<span className="rounded-pill bg-muted px-2 py-0.5 font-stats text-[0.65rem] text-muted-foreground">
					{learners.length}
				</span>
				{learners.length > 0 ? (
					<span className="text-muted-foreground text-xs">
						{t("grouping.tap_to_select", {
							defaultValue: "Tap to select",
						})}
					</span>
				) : null}
			</div>
			<div
				ref={setNodeRef}
				data-testid="unassigned-pool"
				className={cn(
					"grid min-h-16 gap-1.5 rounded-card border border-dashed p-2.5 transition-colors sm:grid-cols-2 lg:grid-cols-3",
					isOver
						? "border-brand-primary bg-brand-primary-light/40"
						: "border-border",
				)}
			>
				{learners.length === 0 ? (
					<p className="col-span-full py-3 text-center text-muted-foreground text-xs">
						{totalLearners === 0
							? t("grouping.no_learners", {
									defaultValue: "No learners have enrolled yet.",
								})
							: t("grouping.all_assigned", {
									defaultValue: "Everyone is in a group 🎉",
								})}
					</p>
				) : (
					learners.map((learner) => (
						<SelectableChip
							key={learner.userId}
							member={{ ...learner, role: "member" }}
							selected={selected.has(learner.userId)}
							onToggle={() => onToggleSelect(learner.userId)}
						/>
					))
				)}
			</div>
		</div>
	);
}

/** A drag handle span (not a <button>, which can swallow pointer events dnd-kit
 *  needs). Touch-action:none so touch-drag works from the grip while the rest
 *  of the page still scrolls. */
function DragGrip({
	member,
	from,
}: {
	member: GroupMember;
	from: string | null;
}) {
	const { attributes, listeners, setNodeRef } = useDraggable({
		id: member.userId,
		data: { from, member },
	});
	const { t } = useTranslation("authoring");
	return (
		<button
			type="button"
			ref={setNodeRef}
			aria-label={t("grouping.drag_handle", { defaultValue: "Drag to move" })}
			className="hidden shrink-0 cursor-grab touch-none items-center text-muted-foreground active:cursor-grabbing sm:flex"
			{...attributes}
			{...listeners}
		>
			<GripVertical className="size-3.5" />
		</button>
	);
}

/** Unassigned learner — the whole chip toggles selection; a grip drags it. */
function SelectableChip({
	member,
	selected,
	onToggle,
}: {
	member: GroupMember;
	selected: boolean;
	onToggle: () => void;
}) {
	const { t } = useTranslation("authoring");
	return (
		<div
			className={cn(
				"flex items-center gap-1.5 rounded-btn border bg-card px-2 py-1.5 shadow-sm transition-colors",
				selected
					? "border-brand-primary bg-brand-primary-light/30"
					: "border-border",
			)}
		>
			<DragGrip member={member} from={null} />
			<button
				type="button"
				aria-pressed={selected}
				onClick={onToggle}
				className="flex min-w-0 flex-1 items-center gap-2 text-left"
			>
				<span
					className={cn(
						"flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
						selected
							? "border-brand-primary bg-brand-primary text-white"
							: "border-border",
					)}
				>
					{selected ? <Check className="size-3.5" /> : null}
				</span>
				<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-primary-light font-semibold text-[0.65rem] text-brand-primary">
					{initials(member.name)}
				</span>
				<span className="min-w-0 flex-1">
					<span className="block truncate text-foreground text-sm">
						{member.name}
					</span>
					{member.skillLevel ? (
						<span className="text-[0.65rem] text-muted-foreground capitalize">
							{t(`grouping.level_${member.skillLevel}`, {
								defaultValue: member.skillLevel,
							})}
						</span>
					) : null}
				</span>
			</button>
		</div>
	);
}

/** A learner already in a group — a grip drags them, a Move button opens the sheet. */
function MemberChip({
	member,
	currentGroupId,
	onRequestMove,
}: {
	member: GroupMember;
	currentGroupId: string | null;
	onRequestMove: (target: MoveTarget) => void;
}) {
	const { t } = useTranslation("authoring");
	return (
		<div className="flex items-center gap-1.5 rounded-btn border border-border bg-card px-2 py-1.5 shadow-sm">
			<DragGrip member={member} from={currentGroupId} />
			<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-primary-light font-semibold text-[0.65rem] text-brand-primary">
				{initials(member.name)}
			</span>
			<span className="min-w-0 flex-1">
				<span className="flex items-center gap-1">
					<span className="truncate text-foreground text-sm">
						{member.name}
					</span>
					{member.role === "lead" ? (
						<Crown className="size-3 shrink-0 text-brand-accent" />
					) : null}
				</span>
				{member.skillLevel ? (
					<span className="text-[0.65rem] text-muted-foreground capitalize">
						{t(`grouping.level_${member.skillLevel}`, {
							defaultValue: member.skillLevel,
						})}
					</span>
				) : null}
			</span>
			<button
				type="button"
				onClick={() => onRequestMove({ member, from: currentGroupId })}
				className="flex shrink-0 items-center gap-1 rounded-btn border border-border px-2 py-1 text-muted-foreground text-xs hover:border-brand-primary/40 hover:text-foreground"
			>
				<ArrowRightLeft className="size-3.5" />
				{t("grouping.move", { defaultValue: "Move" })}
			</button>
		</div>
	);
}

/** Sheet backdrop + panel shared by the single-move and bulk-picker sheets. */
function SheetShell({
	label,
	onClose,
	children,
}: {
	label: string;
	onClose: () => void;
	children: React.ReactNode;
}) {
	const { t } = useTranslation("authoring");
	return createPortal(
		<div
			className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4"
			role="presentation"
		>
			<motion.button
				type="button"
				aria-label={t("editor.cancel", { defaultValue: "Cancel" })}
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				onClick={onClose}
				className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
			/>
			<motion.div
				role="dialog"
				aria-label={label}
				initial={{ y: "100%", opacity: 0.6 }}
				animate={{ y: 0, opacity: 1 }}
				exit={{ y: "100%", opacity: 0.6 }}
				transition={{ type: "spring", stiffness: 380, damping: 38 }}
				className="relative max-h-[80dvh] w-full overflow-y-auto rounded-t-card border-border border-t bg-popover pb-[env(safe-area-inset-bottom)] shadow-card-hover sm:max-w-sm sm:rounded-card sm:border"
			>
				{children}
			</motion.div>
		</div>,
		document.body,
	);
}

function MoveSheet({
	target,
	groups,
	onMove,
	onNewGroup,
	onSetLead,
	onClose,
}: {
	target: MoveTarget | null;
	groups: CohortGroup[];
	onMove: (to: Destination) => void;
	onNewGroup: () => void;
	onSetLead: () => void;
	onClose: () => void;
}) {
	const { t } = useTranslation("authoring");
	return (
		<AnimatePresence>
			{target ? (
				<SheetShell
					label={t("grouping.move", { defaultValue: "Move" })}
					onClose={onClose}
				>
					<div className="flex items-center justify-between gap-3 border-border border-b px-4 py-3">
						<span className="flex min-w-0 items-center gap-2">
							<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-primary-light font-semibold text-[0.7rem] text-brand-primary">
								{initials(target.member.name)}
							</span>
							<span className="truncate font-display text-foreground text-sm">
								{target.member.name}
							</span>
						</span>
						<button
							type="button"
							aria-label={t("editor.cancel", { defaultValue: "Cancel" })}
							onClick={onClose}
							className="flex size-8 shrink-0 items-center justify-center rounded-btn text-muted-foreground hover:bg-accent hover:text-foreground"
						>
							<X className="size-4" />
						</button>
					</div>

					<div className="p-2">
						{target.from ? (
							<button
								type="button"
								onClick={onSetLead}
								className="flex w-full items-center gap-2.5 rounded-btn px-3 py-3 text-left text-foreground text-sm hover:bg-accent"
							>
								<Crown className="size-4 text-brand-accent" />
								{t("grouping.make_lead", { defaultValue: "Make group lead" })}
							</button>
						) : null}

						<p className="px-3 pt-2 pb-1 font-medium text-[0.65rem] text-muted-foreground uppercase tracking-wide">
							{t("grouping.move_to", { defaultValue: "Move to" })}
						</p>
						<button
							type="button"
							onClick={onNewGroup}
							className="flex w-full items-center gap-2.5 rounded-btn px-3 py-3 text-left font-medium text-brand-primary text-sm hover:bg-accent"
						>
							<Plus className="size-4" />
							{t("grouping.new_group_for", { defaultValue: "New group" })}
						</button>
						{groups
							.filter((g) => g.id !== target.from)
							.map((g) => (
								<button
									key={g.id}
									type="button"
									onClick={() => onMove(g.id)}
									className="flex w-full items-center gap-2.5 rounded-btn px-3 py-3 text-left text-foreground text-sm hover:bg-accent"
								>
									<Users className="size-4 text-brand-primary" />
									{g.name ?? t("grouping.untitled", { defaultValue: "Group" })}
								</button>
							))}

						{target.from ? (
							<button
								type="button"
								onClick={() => onMove(null)}
								className="mt-1 flex w-full items-center gap-2.5 border-border border-t px-3 py-3 text-left text-muted-foreground text-sm hover:bg-accent"
							>
								<X className="size-4" />
								{t("grouping.remove_from_group", {
									defaultValue: "Remove from group",
								})}
							</button>
						) : null}
					</div>
				</SheetShell>
			) : null}
		</AnimatePresence>
	);
}

/** Bulk picker: send the selected learners to an existing group. */
function PickerSheet({
	open,
	groups,
	count,
	onPick,
	onClose,
}: {
	open: boolean;
	groups: CohortGroup[];
	count: number;
	onPick: (groupId: string) => void;
	onClose: () => void;
}) {
	const { t } = useTranslation("authoring");
	return (
		<AnimatePresence>
			{open ? (
				<SheetShell
					label={t("grouping.add_to_group", { defaultValue: "Add to group" })}
					onClose={onClose}
				>
					<div className="flex items-center justify-between gap-3 border-border border-b px-4 py-3">
						<span className="font-display text-foreground text-sm">
							{t("grouping.add_n_to", {
								count,
								defaultValue: "Add {{count}} to…",
							})}
						</span>
						<button
							type="button"
							aria-label={t("editor.cancel", { defaultValue: "Cancel" })}
							onClick={onClose}
							className="flex size-8 shrink-0 items-center justify-center rounded-btn text-muted-foreground hover:bg-accent hover:text-foreground"
						>
							<X className="size-4" />
						</button>
					</div>
					<div className="p-2">
						{groups.map((g) => (
							<button
								key={g.id}
								type="button"
								onClick={() => onPick(g.id)}
								className="flex w-full items-center gap-2.5 rounded-btn px-3 py-3 text-left text-foreground text-sm hover:bg-accent"
							>
								<Users className="size-4 text-brand-primary" />
								{g.name ?? t("grouping.untitled", { defaultValue: "Group" })}
							</button>
						))}
					</div>
				</SheetShell>
			) : null}
		</AnimatePresence>
	);
}
