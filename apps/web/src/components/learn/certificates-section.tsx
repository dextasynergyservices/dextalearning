import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Award, Download, ExternalLink, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
	certificateKeys,
	downloadCertificate,
	getMyCertificates,
} from "@/lib/certificates-api";

/**
 * The learner's earned certificates on the My Learning hub (§5.8). Each row
 * downloads a fresh signed PDF or opens the public verification page. Renders
 * nothing until at least one certificate exists, so it never adds empty chrome.
 */
export function CertificatesSection() {
	const { t } = useTranslation("dashboard");
	const { data } = useQuery({
		queryKey: certificateKeys.mine,
		queryFn: getMyCertificates,
	});

	const download = useMutation({
		mutationFn: (id: string) => downloadCertificate(id),
		onError: (e) => toast.error(e.message),
	});

	if (!data || data.length === 0) return null;

	return (
		<section>
			<h2 className="flex items-center gap-2 font-display text-foreground text-lg">
				<Award className="size-5 text-brand-primary" />
				{t("my.certificates", { defaultValue: "Your certificates" })}
			</h2>
			<div className="mt-3 space-y-2">
				{data.map((cert) => (
					<div
						key={cert.id}
						className="flex items-center gap-3 rounded-card border border-border bg-card p-4 shadow-card"
					>
						<span className="flex size-10 shrink-0 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
							<Award className="size-5" />
						</span>
						<div className="min-w-0 flex-1">
							<p className="truncate font-medium text-foreground text-sm">
								{cert.contentTitle}
							</p>
							<p className="text-muted-foreground text-xs">
								{t("my.cert_issued", {
									defaultValue: "Issued {{date}}",
									date: new Date(cert.issuedAt).toLocaleDateString(),
								})}
							</p>
						</div>
						<Link
							to="/verify/$token"
							params={{ token: cert.verifyToken }}
							className="flex size-9 items-center justify-center rounded-btn text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							aria-label={t("my.cert_verify", { defaultValue: "Verify" })}
							title={t("my.cert_verify", { defaultValue: "Verify" })}
						>
							<ExternalLink className="size-4" />
						</Link>
						<button
							type="button"
							onClick={() => download.mutate(cert.id)}
							disabled={download.isPending}
							className="inline-flex h-9 items-center gap-1.5 rounded-btn bg-brand-primary px-3 font-medium text-sm text-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
						>
							{download.isPending && download.variables === cert.id ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Download className="size-4" />
							)}
							{t("my.cert_download", { defaultValue: "PDF" })}
						</button>
					</div>
				))}
			</div>
		</section>
	);
}
