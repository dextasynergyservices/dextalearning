import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, LayoutDashboard, LogOut, Trophy } from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { LearnerShell } from "@/components/layout/learner-shell";
import { Reveal } from "@/components/marketing/reveal";
import { buttonVariants } from "@/components/ui/button";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
	component: ProfilePage,
});

function initialsOf(name?: string | null): string {
	if (!name) return "?";
	return name
		.split(" ")
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

const QUICK_LINKS: {
	to: string;
	key: string;
	icon: ComponentType<{ className?: string }>;
}[] = [
	{ to: "/dashboard", key: "dashboard", icon: LayoutDashboard },
	{ to: "/leaderboard", key: "awards", icon: Trophy },
];

function ProfilePage() {
	const { t } = useTranslation(["dashboard", "common"]);
	const navigate = useNavigate();
	const { data: session } = useSession();
	const user = session?.user;

	const handleSignOut = async () => {
		await signOut();
		navigate({ to: "/" });
	};

	return (
		<LearnerShell title={t("profile.title")}>
			<div className="pt-5 lg:pt-6">
				<h2 className="font-display text-2xl text-slate-900 sm:text-3xl">
					{t("profile.title")}
				</h2>
				<p className="mt-1 text-slate-500">{t("profile.subtitle")}</p>

				<Reveal className="mt-6 space-y-5" y={18}>
					{/* Identity card — populated from the live Better Auth session. */}
					<div className="flex items-center gap-4 overflow-hidden rounded-card border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-card">
						{user?.image ? (
							<img
								src={user.image}
								alt=""
								className="size-16 rounded-full object-cover ring-2 ring-brand-primary/20"
							/>
						) : (
							<span className="flex size-16 items-center justify-center rounded-full bg-brand-primary font-display text-white text-xl">
								{initialsOf(user?.name)}
							</span>
						)}
						<div className="flex-1">
							<p className="font-display text-lg text-slate-900">
								{user?.name ?? "—"}
							</p>
							<p className="text-slate-500 text-sm">{user?.email ?? ""}</p>
						</div>
					</div>

					{/* Quick links */}
					<div className="divide-y divide-slate-100 overflow-hidden rounded-card border border-slate-200 bg-white shadow-card">
						{QUICK_LINKS.map(({ to, key, icon: Icon }) => (
							<Link
								key={to}
								to={to}
								className="flex items-center gap-3 p-4 transition-colors hover:bg-slate-50"
							>
								<span className="flex size-9 items-center justify-center rounded-full bg-brand-primary-light text-brand-primary">
									<Icon className="size-5" />
								</span>
								<span className="flex-1 font-medium text-slate-700">
									{t(`common:account.${key}`)}
								</span>
								<ChevronRight className="size-4 text-slate-300" />
							</Link>
						))}
					</div>

					{/* Language */}
					<div className="rounded-card border border-slate-200 bg-white shadow-card">
						<div className="flex items-center justify-between p-4">
							<span className="font-medium text-slate-700">
								{t("profile.language")}
							</span>
							<LanguageSwitcher />
						</div>
					</div>

					<button
						type="button"
						onClick={handleSignOut}
						className={cn(
							buttonVariants({ variant: "outline", size: "md" }),
							"w-full border-error/30 text-error hover:bg-error/5",
						)}
					>
						<LogOut className="size-4" /> {t("profile.sign_out")}
					</button>
				</Reveal>
			</div>
		</LearnerShell>
	);
}
