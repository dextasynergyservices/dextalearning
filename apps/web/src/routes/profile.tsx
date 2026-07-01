import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	BadgeCheck,
	ChevronRight,
	LayoutDashboard,
	Loader2,
	LogOut,
	ShieldAlert,
	Trophy,
} from "lucide-react";
import { type ComponentType, type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AvatarEditor } from "@/components/authoring/avatar-editor";
import { LearnerShell } from "@/components/layout/learner-shell";
import { FadeIn } from "@/components/marketing/fade-in";
import { Button, buttonVariants } from "@/components/ui/button";
import { homeForRole, signOut, useSession } from "@/lib/auth-client";
import { getMyProfile, updateMyProfile } from "@/lib/content-api";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
	component: ProfilePage,
});

const LANGUAGE_LABELS: Record<string, string> = {
	en: "English",
	fr: "Français",
	es: "Español",
	pcm: "Naijá (Pidgin)",
};

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

function Group({ label, children }: { label: string; children: ReactNode }) {
	return (
		<section>
			<p className="mb-2 px-1 font-stats font-semibold text-muted-foreground text-xs uppercase tracking-wide">
				{label}
			</p>
			<div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
				{children}
			</div>
		</section>
	);
}

function Field({
	label,
	value,
	onChange,
	type = "text",
	autoComplete,
	placeholder,
	readOnly,
	hint,
}: {
	label: string;
	value: string;
	onChange?: (value: string) => void;
	type?: string;
	autoComplete?: string;
	placeholder?: string;
	readOnly?: boolean;
	hint?: ReactNode;
}) {
	return (
		<label className="block">
			<span className="mb-1.5 block font-medium text-foreground text-sm">
				{label}
			</span>
			<input
				type={type}
				value={value}
				onChange={(e) => onChange?.(e.target.value)}
				autoComplete={autoComplete}
				placeholder={placeholder}
				readOnly={readOnly}
				className={cn(
					"h-12 w-full rounded-input border border-border px-4 text-foreground outline-none transition-colors placeholder:text-muted-foreground",
					readOnly
						? "cursor-not-allowed bg-muted text-muted-foreground"
						: "bg-card focus:border-brand-primary",
				)}
			/>
			{hint ? <span className="mt-1 block text-xs">{hint}</span> : null}
		</label>
	);
}

function ProfilePage() {
	const { t, i18n } = useTranslation(["dashboard", "common"]);
	const navigate = useNavigate();
	const { data: session } = useSession();
	const role = (session?.user as { role?: string } | undefined)?.role;
	const queryClient = useQueryClient();
	const { data } = useQuery({
		queryKey: ["my-profile"],
		queryFn: getMyProfile,
	});

	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [otherNames, setOtherNames] = useState("");
	const [phone, setPhone] = useState("");
	const [image, setImage] = useState<string | null>(null);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		if (data && !ready) {
			setFirstName(data.firstName ?? "");
			setLastName(data.lastName ?? "");
			setOtherNames(data.otherNames ?? "");
			setPhone(data.phone ?? "");
			setImage(data.image ?? null);
			setReady(true);
		}
	}, [data, ready]);

	const save = useMutation({
		mutationFn: () =>
			updateMyProfile({
				firstName: firstName.trim(),
				lastName: lastName.trim(),
				otherNames: otherNames.trim(),
				phone: phone.trim(),
				language: i18n.resolvedLanguage,
			}),
		onSuccess: () => {
			toast.success(t("profile.saved", { defaultValue: "Profile saved." }));
			queryClient.invalidateQueries({ queryKey: ["my-profile"] });
		},
		onError: (error) =>
			toast.error(
				error instanceof Error
					? error.message
					: t("toasts.error", { defaultValue: "Something went wrong." }),
			),
	});

	const canSave = firstName.trim().length > 0 && lastName.trim().length > 0;
	const liveName = `${firstName} ${lastName}`.trim() || data?.name || "";
	const phoneTrimmed = phone.trim();
	const phoneSaved = (data?.phone ?? "") === phoneTrimmed;

	const handleSignOut = async () => {
		await signOut();
		navigate({ to: "/" });
	};

	return (
		<LearnerShell title={t("profile.title")}>
			<div className="space-y-6 pt-5 lg:pt-6">
				<div>
					<h2 className="font-display text-2xl text-foreground sm:text-3xl">
						{t("profile.title")}
					</h2>
					<p className="mt-1 text-muted-foreground">{t("profile.subtitle")}</p>
				</div>

				<div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-start">
					{/* Identity card */}
					<section className="rounded-card border border-border bg-card p-6 text-center shadow-card lg:sticky lg:top-24">
						<div className="flex flex-col items-center gap-4">
							<AvatarEditor
								image={image}
								name={liveName}
								onChange={(url) => {
									setImage(url);
									queryClient.invalidateQueries({ queryKey: ["my-profile"] });
								}}
							/>
							<div>
								<p className="font-display text-xl text-foreground">
									{liveName || "—"}
								</p>
								<p className="mt-0.5 text-muted-foreground text-sm">
									{data?.email ?? session?.user?.email ?? ""}
								</p>
								{role ? (
									<span className="badge-free mt-3 capitalize">{role}</span>
								) : null}
							</div>
						</div>
					</section>

					{/* Editable form */}
					<FadeIn className="space-y-6">
						<Group label={t("profile.account")}>
							<div className="space-y-4 p-4">
								<div className="grid gap-4 sm:grid-cols-2">
									<Field
										label={t("profile.first_name", {
											defaultValue: "First name",
										})}
										value={firstName}
										onChange={setFirstName}
										autoComplete="given-name"
									/>
									<Field
										label={t("profile.last_name", {
											defaultValue: "Last name",
										})}
										value={lastName}
										onChange={setLastName}
										autoComplete="family-name"
									/>
								</div>
								<Field
									label={t("profile.other_names", {
										defaultValue: "Other names (optional)",
									})}
									value={otherNames}
									onChange={setOtherNames}
								/>
								<Field
									label={t("profile.email")}
									value={data?.email ?? session?.user?.email ?? ""}
									readOnly
									hint={
										<span className="text-muted-foreground">
											{t("profile.email_locked", {
												defaultValue: "Email can't be changed.",
											})}
										</span>
									}
								/>
								<div>
									<div className="mb-1.5 flex items-center justify-between gap-2">
										<span className="font-medium text-foreground text-sm">
											{t("profile.phone", { defaultValue: "Phone (WhatsApp)" })}
										</span>
										{phoneTrimmed ? (
											data?.phoneVerified && phoneSaved ? (
												<span className="inline-flex items-center gap-1 rounded-pill bg-success/10 px-2 py-0.5 font-stats font-semibold text-[0.6rem] text-success uppercase tracking-wide">
													<BadgeCheck className="size-3" />
													{t("profile.verified", { defaultValue: "Verified" })}
												</span>
											) : (
												<span className="inline-flex items-center gap-1 rounded-pill bg-warning/10 px-2 py-0.5 font-stats font-semibold text-[0.6rem] text-warning uppercase tracking-wide">
													<ShieldAlert className="size-3" />
													{t("profile.not_verified", {
														defaultValue: "Not verified",
													})}
												</span>
											)
										) : null}
									</div>
									<input
										type="tel"
										value={phone}
										onChange={(e) => setPhone(e.target.value)}
										autoComplete="tel"
										placeholder="+234 800 000 0000"
										className="h-12 w-full rounded-input border border-border bg-card px-4 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-primary"
									/>
									<span className="mt-1 block text-muted-foreground text-xs">
										{t("profile.phone_hint", {
											defaultValue: "Optional — for WhatsApp study reminders.",
										})}
									</span>
								</div>
								<label className="block">
									<span className="mb-1.5 block font-medium text-foreground text-sm">
										{t("profile.language")}
									</span>
									<select
										value={i18n.resolvedLanguage}
										onChange={(e) => void i18n.changeLanguage(e.target.value)}
										className="h-12 w-full cursor-pointer rounded-input border border-border bg-card px-4 text-foreground outline-none transition-colors focus:border-brand-primary"
									>
										{SUPPORTED_LANGUAGES.map((lng) => (
											<option key={lng} value={lng}>
												{LANGUAGE_LABELS[lng] ?? lng}
											</option>
										))}
									</select>
								</label>
								<Button
									size="lg"
									onClick={() => save.mutate()}
									disabled={!canSave || save.isPending}
									className="w-full"
								>
									{save.isPending ? (
										<Loader2 className="size-4 animate-spin" />
									) : null}
									{t("profile.save", { defaultValue: "Save changes" })}
								</Button>
							</div>
						</Group>

						<Group label={t("profile.more")}>
							{quickLinksFor(role).map(({ to, key, icon: Icon }) => (
								<Link
									key={to}
									to={to}
									className="flex items-center gap-3 border-border border-b p-4 transition-colors last:border-b-0 hover:bg-accent"
								>
									<span className="flex size-9 items-center justify-center rounded-full bg-brand-primary-light text-brand-primary">
										<Icon className="size-5" />
									</span>
									<span className="flex-1 font-medium text-foreground">
										{t(`common:account.${key}`)}
									</span>
									<ChevronRight className="size-4 text-muted-foreground" />
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
