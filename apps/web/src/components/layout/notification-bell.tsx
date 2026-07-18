import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
	AlertTriangle,
	Award,
	Bell,
	BellRing,
	BookOpenCheck,
	ClipboardCheck,
	GraduationCap,
	Inbox,
	Sparkles,
	Sprout,
	Wallet,
} from "lucide-react";
import { type ComponentType, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useSession } from "@/lib/auth-client";
import {
	type AppNotification,
	engagementKeys,
	listNotifications,
	markAllNotificationsRead,
} from "@/lib/engagement-api";
import { cn } from "@/lib/utils";

const TYPE_META: Record<
	string,
	{
		icon: ComponentType<{ className?: string }>;
		to: string;
		tint: string;
		/**
		 * Where an **admin** recipient should land instead, when the same
		 * notification exists in both studios (e.g. a project's grading queue).
		 */
		adminTo?: string;
		/** Route params pulled off the notification's own payload. */
		params?: (data: Record<string, unknown>) => Record<string, string>;
	}
> = {
	reminder_digest: {
		icon: BookOpenCheck,
		to: "/learn/mine",
		tint: "bg-info/10 text-info",
	},
	badge_awarded: {
		icon: Award,
		to: "/leaderboard",
		tint: "bg-warning/15 text-amber-600 dark:text-amber-400",
	},
	coach_digest: {
		icon: Sprout,
		to: "/dashboard",
		tint: "bg-success/10 text-success",
	},
	dropoff_alert: {
		icon: AlertTriangle,
		to: "/dashboard",
		tint: "bg-warning/15 text-amber-600 dark:text-amber-400",
	},
	certificate_issued: {
		icon: GraduationCap,
		to: "/learn/mine",
		tint: "bg-brand-primary/10 text-brand-primary",
	},
	project_graded: {
		icon: ClipboardCheck,
		to: "/learn/mine",
		tint: "bg-info/10 text-info",
	},
	// Creator-facing: lands straight in that project's grading queue (§4.5),
	// so "you have work" and "here's the work" are one tap apart.
	project_submission_received: {
		icon: Inbox,
		to: "/instructor/project-submissions/$projectId",
		adminTo: "/admin/project-submissions/$projectId",
		params: (data) => ({ projectId: String(data.projectId ?? "") }),
		tint: "bg-brand-primary/10 text-brand-primary",
	},
	assessment_invalidated: {
		icon: AlertTriangle,
		to: "/learn/mine",
		tint: "bg-error/10 text-error",
	},
	final_failed: {
		icon: AlertTriangle,
		to: "/learn/mine",
		tint: "bg-warning/15 text-amber-600 dark:text-amber-400",
	},
	payout_processed: {
		icon: Wallet,
		to: "/instructor/earnings",
		tint: "bg-success/10 text-success",
	},
	payout_failed: {
		icon: Wallet,
		to: "/instructor/earnings",
		tint: "bg-error/10 text-error",
	},
	earn_back_processed: {
		icon: Sparkles,
		to: "/learn/mine",
		tint: "bg-success/10 text-success",
	},
	earn_back_no_payout: {
		icon: Award,
		to: "/learn/mine",
		tint: "bg-muted text-muted-foreground",
	},
	earn_back_failed: {
		icon: Sparkles,
		to: "/learn/mine",
		tint: "bg-warning/15 text-amber-600 dark:text-amber-400",
	},
	payout_failed_admin: {
		icon: AlertTriangle,
		to: "/admin/payouts",
		tint: "bg-error/10 text-error",
	},
	earn_back_failed_admin: {
		icon: AlertTriangle,
		to: "/admin/payouts",
		tint: "bg-error/10 text-error",
	},
};
const DEFAULT_TYPE_META = {
	icon: BellRing,
	to: "/dashboard",
	tint: "bg-muted text-muted-foreground",
};

function timeAgo(iso: string, language: string): string {
	const rtf = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
	const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
	if (minutes > -60) return rtf.format(minutes, "minute");
	const hours = Math.round(minutes / 60);
	if (hours > -24) return rtf.format(hours, "hour");
	return rtf.format(Math.round(hours / 24), "day");
}

/**
 * In-app notification bell (§8.6 "In-App" channel — Phase 5 adds web push):
 * unread-count dot, and a panel that renders as a dropdown on desktop and a
 * drag-to-dismiss bottom sheet on mobile. Items deep-link by type; opening
 * the panel marks everything read.
 */
export function NotificationBell() {
	const { t, i18n } = useTranslation("engagement");
	const queryClient = useQueryClient();
	const { data: session } = useSession();
	// Better Auth's inferred user type doesn't carry our `role` column.
	const isAdmin =
		(session?.user as { role?: string } | undefined)?.role === "admin";
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	// The mobile sheet is portaled to <body>, outside containerRef — track it
	// separately so taps inside it don't count as outside-clicks.
	const sheetRef = useRef<HTMLDivElement>(null);

	const { data } = useQuery({
		queryKey: engagementKeys.notifications,
		queryFn: () => listNotifications({ limit: 15 }),
	});
	const unread = data?.unreadCount ?? 0;

	const markAll = useMutation({
		mutationFn: markAllNotificationsRead,
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: engagementKeys.notifications }),
	});

	// Read-on-open (§3.2 — the dot is the cue, not a chore to clear by hand).
	// biome-ignore lint/correctness/useExhaustiveDependencies: fires on open only
	useEffect(() => {
		if (open && unread > 0 && !markAll.isPending) markAll.mutate();
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const onPointer = (event: MouseEvent) => {
			const target = event.target as Node;
			if (
				!containerRef.current?.contains(target) &&
				!sheetRef.current?.contains(target)
			) {
				setOpen(false);
			}
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onPointer);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onPointer);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const items = data?.notifications ?? [];

	const renderItem = (item: AppNotification) => {
		const meta = TYPE_META[item.type] ?? DEFAULT_TYPE_META;
		const badgeKey =
			item.type === "badge_awarded" && item.data
				? String(item.data.badgeKey ?? "")
				: null;
		// Some notifications exist in both studios — send admins to theirs.
		const to = isAdmin && meta.adminTo ? meta.adminTo : meta.to;
		const params = meta.params?.(item.data ?? {});
		return (
			<li key={item.id}>
				<Link
					// biome-ignore lint/suspicious/noExplicitAny: typed route paths vary by notification type.
					to={to as any}
					// biome-ignore lint/suspicious/noExplicitAny: param shape varies to match whichever route `to` resolves to.
					params={params as any}
					onClick={() => setOpen(false)}
					className="flex items-start gap-3 rounded-btn px-3 py-2.5 transition-colors hover:bg-accent"
				>
					<span
						className={cn(
							"mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
							meta.tint,
						)}
					>
						<meta.icon className="size-4" />
					</span>
					<span className="min-w-0 flex-1">
						<span
							className={cn(
								"block text-sm",
								item.readAt
									? "text-muted-foreground"
									: "font-medium text-foreground",
							)}
						>
							{t([
								`notifications.types.${item.type}.title`,
								"notifications.types.default.title",
							])}
						</span>
						<span className="block text-muted-foreground text-xs">
							{t(
								[
									`notifications.types.${item.type}.body`,
									"notifications.types.default.body",
								],
								{
									...(item.data ?? {}),
									...(badgeKey ? { name: t(`badges.${badgeKey}.name`) } : {}),
								},
							)}
						</span>
						<span className="mt-0.5 block text-[0.65rem] text-muted-foreground/80">
							{timeAgo(item.createdAt, i18n.language)}
						</span>
					</span>
					{!item.readAt ? (
						<span className="mt-2 size-2 shrink-0 rounded-full bg-brand-solid" />
					) : null}
				</Link>
			</li>
		);
	};

	const panelBody = (
		<>
			<div className="flex items-center justify-between border-border border-b px-4 py-3">
				<p className="font-display text-foreground">
					{t("notifications.title")}
				</p>
				{items.length > 0 ? (
					<button
						type="button"
						onClick={() => markAll.mutate()}
						className="text-brand-primary text-xs transition-colors hover:underline"
					>
						{t("notifications.mark_all_read")}
					</button>
				) : null}
			</div>
			{items.length === 0 ? (
				<p className="px-4 py-8 text-center text-muted-foreground text-sm">
					{t("notifications.empty")}
				</p>
			) : (
				<ul className="max-h-96 overflow-y-auto p-1.5">
					{items.map(renderItem)}
				</ul>
			)}
		</>
	);

	return (
		<div ref={containerRef} className="relative">
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-label={t("notifications.open")}
				className="relative flex size-9 items-center justify-center rounded-btn text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
			>
				<Bell className="size-5" />
				{unread > 0 ? (
					<span
						data-testid="notification-dot"
						className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-brand-solid font-stats font-bold text-[0.6rem] text-white"
					>
						{unread > 9 ? "9+" : unread}
					</span>
				) : null}
			</button>

			<AnimatePresence>
				{open ? (
					<>
						{/* Desktop dropdown */}
						<motion.div
							role="dialog"
							aria-label={t("notifications.title")}
							initial={{ opacity: 0, y: -6, scale: 0.97 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: -6, scale: 0.97 }}
							transition={{ duration: 0.16, ease: "easeOut" }}
							className="absolute right-0 z-50 mt-2 hidden w-80 overflow-hidden rounded-card border border-border bg-popover shadow-card-hover lg:block"
						>
							{panelBody}
						</motion.div>

						{/* Mobile bottom sheet (drag down to dismiss). PORTALED to
						    <body>: the sticky header's backdrop-blur creates a CSS
						    containing block for fixed descendants, so without the
						    portal this sheet anchors to the header's bottom edge and
						    grows upward off-screen. */}
						{createPortal(
							<div ref={sheetRef} className="fixed inset-0 z-[60] lg:hidden">
								<motion.button
									type="button"
									aria-label={t("notifications.title")}
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									onClick={() => setOpen(false)}
									className="absolute inset-0 bg-slate-900/40"
								/>
								<motion.div
									role="dialog"
									aria-label={t("notifications.title")}
									drag="y"
									dragConstraints={{ top: 0, bottom: 0 }}
									dragElastic={{ top: 0, bottom: 0.6 }}
									onDragEnd={(_, info) => {
										if (info.offset.y > 80 || info.velocity.y > 600) {
											setOpen(false);
										}
									}}
									initial={{ y: "100%" }}
									animate={{ y: 0 }}
									exit={{ y: "100%" }}
									transition={{ type: "spring", stiffness: 380, damping: 38 }}
									className="absolute inset-x-0 bottom-0 max-h-[85dvh] touch-none overflow-hidden rounded-t-card border-border border-t bg-card pb-[env(safe-area-inset-bottom)] shadow-card-hover"
								>
									<div className="mx-auto mt-2 h-1 w-10 cursor-grab rounded-full bg-muted-foreground/30 active:cursor-grabbing" />
									{panelBody}
								</motion.div>
							</div>,
							document.body,
						)}
					</>
				) : null}
			</AnimatePresence>
		</div>
	);
}
