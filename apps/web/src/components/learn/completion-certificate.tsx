import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Award, Download, Loader2, Share2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
	certificateKeys,
	downloadCertificate,
	getMyCertificates,
} from "@/lib/certificates-api";
import type { EnrollableType } from "@/lib/content-api";

/**
 * The certificate "pass moment" on a course/path/cohort learner hub (§5.8).
 * When the learner has completed the entity it celebrates the achievement and
 * puts the earned certificate front-and-centre — download / verify / share —
 * instead of leaving it buried in the My Learning list. While the async
 * issuance job is still running it shows a brief "preparing" state so the
 * learner isn't left wondering. Renders nothing until the entity is complete.
 */
export function CompletionCertificate({
	type,
	entityId,
	title,
	isComplete,
}: {
	type: EnrollableType;
	entityId: string;
	title: string;
	isComplete: boolean;
}) {
	const { t } = useTranslation("certificates");
	const { data } = useQuery({
		queryKey: certificateKeys.mine,
		queryFn: getMyCertificates,
		enabled: isComplete,
		// The cert is issued asynchronously right after completion — poll briefly
		// so it appears without a manual refresh.
		refetchInterval: (query) => {
			const list = query.state.data;
			const has = list?.some(
				(c) => c.entityType === type && c.entityId === entityId,
			);
			return isComplete && !has ? 4000 : false;
		},
	});

	const download = useMutation({
		mutationFn: (id: string) => downloadCertificate(id),
		onError: (e) => toast.error(e.message),
	});

	if (!isComplete) return null;

	const cert = data?.find(
		(c) => c.entityType === type && c.entityId === entityId,
	);

	// Completed, but the issuance job hasn't landed the row yet.
	if (!cert) {
		return (
			<section className="flex items-center gap-3 rounded-card border border-brand-primary/20 bg-brand-primary-light/20 p-4 shadow-card">
				<Loader2 className="size-5 shrink-0 animate-spin text-brand-primary" />
				<div className="min-w-0">
					<p className="font-display text-foreground">
						{t("completion.preparing_title", {
							defaultValue: "Preparing your certificate…",
						})}
					</p>
					<p className="mt-0.5 text-muted-foreground text-sm">
						{t("completion.preparing_body", {
							defaultValue:
								"This takes a moment — it'll appear here and in My Learning shortly.",
						})}
					</p>
				</div>
			</section>
		);
	}

	const share = async () => {
		const url = `${window.location.origin}/verify/${cert.verifyToken}`;
		const shareText = t("completion.share_text", {
			defaultValue: "I earned a certificate for {{title}} on DextaLearning! 🎓",
			title,
		});
		if (navigator.share) {
			try {
				await navigator.share({ title, text: shareText, url });
				return;
			} catch {
				// User dismissed the share sheet — fall through to clipboard.
			}
		}
		try {
			await navigator.clipboard.writeText(url);
			toast.success(
				t("completion.link_copied", {
					defaultValue: "Verification link copied",
				}),
			);
		} catch {
			toast.error(
				t("completion.share_failed", { defaultValue: "Couldn't share" }),
			);
		}
	};

	return (
		<section className="overflow-hidden rounded-card border border-brand-primary/25 bg-gradient-to-br from-brand-primary-light/50 to-brand-accent/10 shadow-card">
			<div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5">
				<span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-solid text-white shadow-card">
					<Award className="size-7" />
				</span>
				<div className="min-w-0 flex-1">
					<p className="font-stats font-semibold text-brand-primary text-xs uppercase tracking-wide">
						{t("completion.eyebrow", { defaultValue: "Certificate earned" })}
					</p>
					<h2 className="mt-0.5 font-display text-foreground text-lg leading-tight">
						{t("completion.earned_title", {
							defaultValue: "Congratulations — you did it! 🎓",
						})}
					</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						{t("completion.earned_body", {
							defaultValue:
								"Your certificate for {{title}} is ready to download and share.",
							title,
						})}
					</p>
				</div>
			</div>
			<div className="flex flex-wrap items-center gap-2 border-brand-primary/15 border-t bg-card/40 px-5 py-3">
				<button
					type="button"
					onClick={() => download.mutate(cert.id)}
					disabled={download.isPending}
					className="inline-flex h-10 items-center gap-2 rounded-btn bg-brand-solid px-4 font-semibold text-sm text-white transition-colors hover:bg-brand-solid-hover active:scale-[0.98] disabled:opacity-50"
				>
					{download.isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Download className="size-4" />
					)}
					{t("completion.download", { defaultValue: "Download PDF" })}
				</button>
				<Link
					to="/verify/$token"
					params={{ token: cert.verifyToken }}
					className="inline-flex h-10 items-center gap-2 rounded-btn border border-border bg-card px-4 font-medium text-foreground text-sm transition-colors hover:bg-accent"
				>
					<ShieldCheck className="size-4" />
					{t("completion.verify", { defaultValue: "Verify" })}
				</Link>
				<button
					type="button"
					onClick={share}
					className="inline-flex h-10 items-center gap-2 rounded-btn border border-border bg-card px-4 font-medium text-foreground text-sm transition-colors hover:bg-accent"
				>
					<Share2 className="size-4" />
					{t("completion.share", { defaultValue: "Share" })}
				</button>
			</div>
		</section>
	);
}
