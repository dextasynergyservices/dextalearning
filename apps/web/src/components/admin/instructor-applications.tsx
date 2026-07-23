import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, UserCheck, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	decideInstructorApplication,
	listInstructorApplications,
} from "@/lib/admin-users-api";
import { cn } from "@/lib/utils";

/**
 * Instructor applications queue (§5). Anyone may ASK to teach at sign-up, but
 * authoring is a trusted capability — their rich text renders in other people's
 * browsers — so they stay a learner until an admin approves here. Approving is
 * what grants the role; rejecting leaves them a learner.
 */
export function InstructorApplications() {
	const { t } = useTranslation("authoring");
	const queryClient = useQueryClient();
	const [deciding, setDeciding] = useState<string | null>(null);

	const { data, isPending } = useQuery({
		queryKey: ["instructor-applications"],
		queryFn: listInstructorApplications,
	});

	const decide = useMutation({
		mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
			decideInstructorApplication(id, approve),
		onSuccess: (_row, { approve }) => {
			queryClient.invalidateQueries({ queryKey: ["instructor-applications"] });
			queryClient.invalidateQueries({ queryKey: ["admin-users"] });
			toast.success(
				approve
					? t("instructors.approved", { defaultValue: "Instructor approved" })
					: t("instructors.rejected", { defaultValue: "Application rejected" }),
			);
		},
		onError: (e) => toast.error(e.message),
		onSettled: () => setDeciding(null),
	});

	// Only the first load hides it; an EMPTY queue still renders its own state.
	// Hiding the section entirely when nothing is waiting makes the feature
	// undiscoverable — an admin has no way to learn where approvals happen.
	if (isPending || !data) return null;
	const waiting = data.length;

	return (
		<section
			className={cn(
				"rounded-card border bg-card shadow-card",
				waiting > 0 ? "border-brand-accent/40" : "border-border",
			)}
		>
			<header className="border-border border-b px-4 py-3 sm:px-6">
				<h2 className="flex items-center gap-2 font-display text-foreground text-lg">
					<UserCheck className="size-5 text-brand-primary" />
					{t("instructors.queue_title", {
						defaultValue: "Instructor applications",
					})}
					{waiting > 0 ? (
						<span className="flex min-w-[1.4rem] items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 font-stats font-bold text-white text-xs">
							{waiting}
						</span>
					) : null}
				</h2>
				<p className="mt-0.5 text-muted-foreground text-sm">
					{t("instructors.queue_hint", {
						defaultValue:
							"They can't create or publish anything until you approve them.",
					})}
				</p>
			</header>

			{waiting === 0 ? (
				<p className="px-4 py-8 text-center text-muted-foreground text-sm sm:px-6">
					{t("instructors.queue_empty", {
						defaultValue:
							"No one is waiting. New instructor applications land here.",
					})}
				</p>
			) : null}

			<ul className="divide-y divide-slate-100">
				{data.map((a) => {
					const busy = deciding === a.id && decide.isPending;
					return (
						<li
							key={a.id}
							className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:px-6"
						>
							<span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-primary-light font-semibold text-brand-primary">
								{a.avatarUrl ? (
									<img
										src={a.avatarUrl}
										alt=""
										className="size-full object-cover"
									/>
								) : (
									(a.name || a.email).slice(0, 1).toUpperCase()
								)}
							</span>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-foreground text-sm">
									{a.name || a.email}
								</p>
								<p className="truncate text-muted-foreground text-xs">
									{a.email}
									{a.headline ? ` · ${a.headline}` : ""}
								</p>
								{a.bio ? (
									<p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
										{a.bio}
									</p>
								) : null}
							</div>
							<div className="flex shrink-0 gap-2">
								<Button
									variant="outline"
									size="sm"
									disabled={busy}
									onClick={() => {
										setDeciding(a.id);
										decide.mutate({ id: a.id, approve: false });
									}}
									className="text-error hover:bg-error/5"
								>
									<X className="size-4" />
									{t("instructors.reject", { defaultValue: "Reject" })}
								</Button>
								<Button
									size="sm"
									disabled={busy}
									onClick={() => {
										setDeciding(a.id);
										decide.mutate({ id: a.id, approve: true });
									}}
								>
									{busy ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<Check className="size-4" />
									)}
									{t("instructors.approve", { defaultValue: "Approve" })}
								</Button>
							</div>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
