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
import { signOut, useSession } from "@/lib/auth-client";
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

	const items = [
		{ to: "/dashboard", label: t("account.dashboard"), icon: LayoutDashboard },
		{ to: "/leaderboard", label: t("account.awards"), icon: Trophy },
		{ to: "/profile", label: t("account.profile"), icon: UserRound },
	] as const;

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
					onDark ? "hover:bg-white/10" : "hover:bg-slate-100",
				)}
			>
				{user.image ? (
					<img
						src={user.image}
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
						onDark ? "text-white/80" : "text-slate-400",
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
						className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-card border border-slate-200 bg-white shadow-card-hover"
					>
						<div className="border-slate-100 border-b px-4 py-3">
							<p className="truncate font-display text-slate-900 text-sm">
								{user.name}
							</p>
							<p className="truncate text-slate-500 text-xs">{user.email}</p>
						</div>
						<div className="p-1.5">
							{items.map(({ to, label, icon: Icon }) => (
								<Link
									key={to}
									to={to}
									onClick={() => setOpen(false)}
									role="menuitem"
									className="flex items-center gap-3 rounded-btn px-3 py-2 text-slate-600 text-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
								>
									<Icon className="size-4 text-slate-400" />
									{label}
								</Link>
							))}
						</div>
						<div className="border-slate-100 border-t p-1.5">
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
