import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ChevronRight,
	Globe,
	LayoutDashboard,
	LogOut,
	Mail,
	ShieldCheck,
	Trophy,
	UserRound,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { LearnerShell } from "@/components/layout/learner-shell";
import { FadeIn } from "@/components/marketing/fade-in";
import { buttonVariants } from "@/components/ui/button";
import { homeForRole, signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
	component: ProfilePage,
});

function initialsOf(name?: string | null): string {
	if (!name) return "?";
	return (
		name
			.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? "")
			.join("") || "?"
	);
}

/** Quick links — "dashboard" lands staff on their Studio, learners on /dashboard. */
function quickLinksFor(role?: string): {
	to: string;
	key: string;
	icon: ComponentType<{ className?: string }>;
}[] {
	return [
		{ to: homeForRole(role), key: "dashboard", icon: LayoutDashboard },
		{ to: "/leaderboard", key: "awards", icon: Trophy },
	];
}

/** A labelled settings group: small caps label + a card of divided rows. */
function Group({ label, children }: { label: string; children: ReactNode }) {
	return (
		<section>
			<p className="mb-2 px-1 font-stats font-semibold text-slate-400 text-xs uppercase tracking-wide">
				{label}
			</p>
			<div className="divide-y divide-slate-100 overflow-hidden rounded-card border border-slate-200 bg-white shadow-card">
				{children}
			</div>
		</section>
	);
}

function InfoRow({
	icon: Icon,
	label,
	value,
}: {
	icon: ComponentType<{ className?: string }>;
	label: string;
	value?: string | null;
}) {
	return (
		<div className="flex items-center gap-3 p-4">
			<Icon className="size-5 shrink-0 text-slate-400" />
			<span className="font-medium text-slate-500 text-sm">{label}</span>
			<span className="ml-auto truncate text-slate-900 text-sm">
				{value || "—"}
			</span>
		</div>
	);
}

function ProfilePage() {
	const { t } = useTranslation(["dashboard", "common"]);
	const navigate = useNavigate();
	const { data: session } = useSession();
	const user = session?.user;
	const role = (user as { role?: string } | undefined)?.role;

	const handleSignOut = async () => {
		await signOut();
		navigate({ to: "/" });
	};

	return (
		<LearnerShell title={t("profile.title")}>
			<div className="space-y-6 pt-5 lg:pt-6">
				<div>
					<h2 className="font-display text-2xl text-slate-900 sm:text-3xl">
						{t("profile.title")}
					</h2>
					<p className="mt-1 text-slate-500">{t("profile.subtitle")}</p>
				</div>

				<div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-start">
					{/* Identity card (flat) */}
					<section className="rounded-card border border-slate-200 bg-white p-6 text-center shadow-card lg:sticky lg:top-24">
						<div className="flex flex-col items-center gap-4">
							{user?.image ? (
								<img
									src={user.image}
									alt=""
									className="size-24 rounded-full object-cover"
								/>
							) : (
								<span className="flex size-24 items-center justify-center rounded-full bg-brand-primary font-display text-3xl text-white">
									{initialsOf(user?.name)}
								</span>
							)}
							<div>
								<p className="font-display text-xl text-slate-900">
									{user?.name ?? "—"}
								</p>
								<p className="mt-0.5 text-slate-500 text-sm">
									{user?.email ?? ""}
								</p>
								{role ? (
									<span className="badge-free mt-3 capitalize">{role}</span>
								) : null}
							</div>
						</div>
					</section>

					{/* Settings */}
					<FadeIn className="space-y-6">
						<Group label={t("profile.account")}>
							<InfoRow
								icon={UserRound}
								label={t("profile.name")}
								value={user?.name}
							/>
							<InfoRow
								icon={Mail}
								label={t("profile.email")}
								value={user?.email}
							/>
							{role ? (
								<InfoRow
									icon={ShieldCheck}
									label={t("profile.role")}
									value={role}
								/>
							) : null}
						</Group>

						<Group label={t("profile.preferences")}>
							<div className="flex items-center gap-3 p-4">
								<Globe className="size-5 shrink-0 text-slate-400" />
								<span className="font-medium text-slate-700 text-sm">
									{t("profile.language")}
								</span>
								<span className="ml-auto">
									<LanguageSwitcher />
								</span>
							</div>
						</Group>

						<Group label={t("profile.more")}>
							{quickLinksFor(role).map(({ to, key, icon: Icon }) => (
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
						</Group>

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
					</FadeIn>
				</div>
			</div>
		</LearnerShell>
	);
}
