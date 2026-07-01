import { Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
	ChevronDown,
	LayoutDashboard,
	LogOut,
	Trophy,
	UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { homeForRole, signOut, useSession } from "@/lib/auth-client";
import { useAvatar } from "@/lib/use-avatar";
import { cn } from "@/lib/utils";

function initialsOf(name?: string | null): string {
	if (!name) return "U";
	return (
		name
			.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? "")
			.join("") || "U"
	);
}

/**
 * Auth-aware account dropdown: an avatar button that opens a menu with
 * Dashboard / Profile / Awards / Sign out. Closes on outside-click or Escape.
 * Shown wherever a signed-in user needs account access (desktop header,
 * learner shell). `onDark` adapts it for transparent dark-hero headers.
 */
export function AccountMenu({ onDark = false }: { onDark?: boolean }) {
	const { t } = useTranslation("common");
	const { data: session } = useSession();
	const avatar = useAvatar();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onPointer = (event: MouseEvent) => {
			if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
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

	if (!session) return null;
	const user = session.user;

	const handleSignOut = async () => {
		setOpen(false);
		await signOut();
		navigate({ to: "/" });
	};

	// Staff (instructor/admin) land on their Studio; learners on /dashboard.
	const role = (user as { role?: string }).role;
	const items = [
		{
			to: homeForRole(role),
			label: t("account.dashboard"),
			icon: LayoutDashboard,
		},
		{ to: "/leaderboard" as const, label: t("account.awards"), icon: Trophy },
		{ to: "/profile" as const, label: t("account.profile"), icon: UserRound },
	];

	return (
		<div ref={containerRef} className="relative">
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label={t("account.menu")}
				className={cn(
					"flex items-center gap-1.5 rounded-full p-0.5 pr-2 transition-colors",
					onDark ? "hover:bg-white/10" : "hover:bg-accent",
				)}
			>
				{avatar ? (
					<img
						src={avatar}
						alt=""
						className="size-8 rounded-full object-cover"
					/>
				) : (
					<span className="flex size-8 items-center justify-center rounded-full bg-brand-primary font-semibold text-[11px] text-white">
						{initialsOf(user.name)}
					</span>
				)}
				<ChevronDown
					className={cn(
						"size-4 transition-transform",
						open && "rotate-180",
						onDark ? "text-white/80" : "text-muted-foreground",
					)}
				/>
			</button>

			<AnimatePresence>
				{open ? (
					<motion.div
						role="menu"
						initial={{ opacity: 0, y: -6, scale: 0.97 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -6, scale: 0.97 }}
						transition={{ duration: 0.16, ease: "easeOut" }}
						className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-card border border-border bg-popover shadow-card-hover"
					>
						<div className="border-border border-b px-4 py-3">
							<p className="truncate font-display text-foreground text-sm">
								{user.name}
							</p>
							<p className="truncate text-muted-foreground text-xs">
								{user.email}
							</p>
						</div>
						<div className="p-1.5">
							{items.map(({ to, label, icon: Icon }) => (
								<Link
									key={to}
									to={to}
									onClick={() => setOpen(false)}
									role="menuitem"
									className="flex items-center gap-3 rounded-btn px-3 py-2 text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-foreground"
								>
									<Icon className="size-4 text-muted-foreground" />
									{label}
								</Link>
							))}
						</div>
						<div className="flex items-center justify-between gap-2 border-border border-t px-4 py-2.5">
							<span className="text-muted-foreground text-sm">
								{t("theme.label", { defaultValue: "Theme" })}
							</span>
							<ThemeToggle />
						</div>
						<div className="border-border border-t p-1.5">
							<button
								type="button"
								onClick={handleSignOut}
								role="menuitem"
								className="flex w-full items-center gap-3 rounded-btn px-3 py-2 text-error text-sm transition-colors hover:bg-error/5"
							>
								<LogOut className="size-4" />
								{t("account.sign_out")}
							</button>
						</div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
}
