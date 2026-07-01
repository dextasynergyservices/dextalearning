import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AvatarEditor } from "@/components/authoring/avatar-editor";
import { StudioShell } from "@/components/authoring/studio-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TagInput } from "@/components/ui/tag-input";
import { getMyProfile, updateMyProfile } from "@/lib/content-api";

const EXPERTISE = [
	"technology",
	"business",
	"design",
	"data",
	"languages",
	"science",
	"arts",
	"health",
	"education",
	"personal",
];

/** Field label + input wrapper. */
function Field({
	id,
	label,
	children,
}: {
	id: string;
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div>
			<label
				htmlFor={id}
				className="mb-1.5 block font-medium text-foreground text-sm"
			>
				{label}
			</label>
			{children}
		</div>
	);
}

const inputCls =
	"h-12 w-full rounded-input border border-border bg-card px-4 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-primary";

/**
 * Studio profile editor (§8.1.1) — instructors/admins edit everything on their
 * public profile (avatar, names, phone, headline, bio, expertise). Email is
 * read-only. Surfaces on every course/path they create + their `/instructors/:id`.
 */
export function ProfileEditor({ area }: { area: "instructor" | "admin" }) {
	const { t } = useTranslation("onboarding");
	const { t: tA } = useTranslation("authoring");
	const queryClient = useQueryClient();
	const { data, isPending } = useQuery({
		queryKey: ["my-profile"],
		queryFn: getMyProfile,
	});

	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [otherNames, setOtherNames] = useState("");
	const [phone, setPhone] = useState("");
	const [headline, setHeadline] = useState("");
	const [bio, setBio] = useState("");
	const [expertise, setExpertise] = useState<string[]>([]);
	const [image, setImage] = useState<string | null>(null);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		if (data && !ready) {
			setFirstName(data.firstName ?? "");
			setLastName(data.lastName ?? "");
			setOtherNames(data.otherNames ?? "");
			setPhone(data.phone ?? "");
			setHeadline(data.headline ?? "");
			setBio(data.bio ?? "");
			setExpertise(data.expertiseAreas ?? []);
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
				headline: headline.trim() || undefined,
				bio: bio.trim() || undefined,
				expertiseAreas: expertise,
			}),
		onSuccess: () => {
			toast.success(tA("profile.saved", { defaultValue: "Profile saved." }));
			queryClient.invalidateQueries({ queryKey: ["my-profile"] });
			queryClient.invalidateQueries({ queryKey: ["instructor"] });
		},
		onError: (error) =>
			toast.error(error instanceof Error ? error.message : "Save failed"),
	});

	const onAvatarChange = (url: string | null) => {
		setImage(url);
		// Refresh the shared avatar (account menu, sidebar) + public profile.
		queryClient.invalidateQueries({ queryKey: ["my-profile"] });
		queryClient.invalidateQueries({ queryKey: ["instructor"] });
	};

	const canSave = firstName.trim().length > 0 && lastName.trim().length > 0;
	const areaSuggestions = EXPERTISE.map((value) => ({
		value,
		label: t(`instructor.areas.${value}`, { defaultValue: value }),
	}));

	return (
		<StudioShell
			title={tA("profile.title", { defaultValue: "Your profile" })}
			area={area}
			action={
				<Button
					size="sm"
					onClick={() => save.mutate()}
					disabled={save.isPending || isPending || !canSave}
				>
					{save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
					{tA("profile.save", { defaultValue: "Save" })}
				</Button>
			}
		>
			{isPending ? (
				<div className="max-w-2xl space-y-4">
					<Skeleton className="h-24 rounded-card" />
					<Skeleton className="h-32 rounded-card" />
				</div>
			) : (
				<div className="max-w-2xl space-y-6">
					<p className="text-muted-foreground text-sm">
						{tA("profile.subtitle", {
							defaultValue:
								"Your public presence on every course, path and cohort you create.",
						})}
					</p>

					{/* Avatar — tap to change / remove */}
					<div className="flex items-center gap-5">
						<AvatarEditor
							image={image}
							name={`${firstName} ${lastName}`.trim() || data?.name || ""}
							onChange={onAvatarChange}
						/>
						<p className="max-w-[12rem] text-muted-foreground text-xs">
							{tA("profile.photo_hint", {
								defaultValue:
									"Tap your photo to change or remove it. PNG, JPG or WebP, up to 5 MB.",
							})}
						</p>
					</div>

					{/* Names */}
					<div className="grid gap-4 sm:grid-cols-2">
						<Field
							id="p-first"
							label={tA("profile.first_name", { defaultValue: "First name" })}
						>
							<input
								id="p-first"
								value={firstName}
								maxLength={100}
								onChange={(e) => setFirstName(e.target.value)}
								className={inputCls}
							/>
						</Field>
						<Field
							id="p-last"
							label={tA("profile.last_name", { defaultValue: "Last name" })}
						>
							<input
								id="p-last"
								value={lastName}
								maxLength={100}
								onChange={(e) => setLastName(e.target.value)}
								className={inputCls}
							/>
						</Field>
					</div>

					<Field
						id="p-other"
						label={tA("profile.other_names", {
							defaultValue: "Other names (optional)",
						})}
					>
						<input
							id="p-other"
							value={otherNames}
							maxLength={100}
							onChange={(e) => setOtherNames(e.target.value)}
							className={inputCls}
						/>
					</Field>

					<div className="grid gap-4 sm:grid-cols-2">
						<Field
							id="p-email"
							label={tA("profile.email", { defaultValue: "Email" })}
						>
							<input
								id="p-email"
								value={data?.email ?? ""}
								readOnly
								disabled
								className={`${inputCls} cursor-not-allowed bg-muted text-muted-foreground`}
							/>
						</Field>
						<Field
							id="p-phone"
							label={tA("profile.phone", { defaultValue: "Phone" })}
						>
							<input
								id="p-phone"
								type="tel"
								value={phone}
								onChange={(e) => setPhone(e.target.value)}
								placeholder="+234 801 234 5678"
								className={inputCls}
							/>
						</Field>
					</div>

					<Field
						id="p-headline"
						label={t("instructor.headline", { defaultValue: "Headline" })}
					>
						<input
							id="p-headline"
							value={headline}
							maxLength={160}
							onChange={(e) => setHeadline(e.target.value)}
							placeholder={t("instructor.headline_ph", {
								defaultValue: "e.g. Senior Product Designer & Educator",
							})}
							className={inputCls}
						/>
					</Field>

					<Field
						id="p-bio"
						label={t("instructor.bio", { defaultValue: "Short bio" })}
					>
						<textarea
							id="p-bio"
							value={bio}
							maxLength={2000}
							rows={5}
							onChange={(e) => setBio(e.target.value)}
							placeholder={t("instructor.bio_ph", {
								defaultValue:
									"Tell learners about your experience and what you teach…",
							})}
							className="w-full resize-none rounded-input border border-border bg-card px-4 py-3 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-primary"
						/>
					</Field>

					<div>
						<p className="mb-2 font-medium text-foreground text-sm">
							{t("instructor.expertise", {
								defaultValue: "Areas of expertise",
							})}
						</p>
						<TagInput
							value={expertise}
							onChange={setExpertise}
							suggestions={areaSuggestions}
							getLabel={(v) => t(`instructor.areas.${v}`, { defaultValue: v })}
							placeholder={tA("profile.expertise_ph", {
								defaultValue: "Type a skill and press Enter, or pick below…",
							})}
						/>
					</div>
				</div>
			)}
		</StudioShell>
	);
}
