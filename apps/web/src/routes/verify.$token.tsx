import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, ShieldAlert, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { certificateKeys, verifyCertificate } from "@/lib/certificates-api";

export const Route = createFileRoute("/verify/$token")({
	component: VerifyCertificatePage,
});

const TYPE_LABEL: Record<string, string> = {
	course: "Course",
	path: "Learning Path",
	cohort: "Cohort",
};

/**
 * Public certificate verification (§5.8) — the QR / URL target. Self-contained
 * (no learner/app shell) so anyone, signed in or not, can confirm a
 * certificate's authenticity.
 */
function VerifyCertificatePage() {
	const { token } = Route.useParams();
	const { t } = useTranslation("authoring");
	const { data, isPending } = useQuery({
		queryKey: certificateKeys.verify(token),
		queryFn: () => verifyCertificate(token),
	});

	return (
		<main className="grid min-h-dvh place-items-center bg-muted/40 px-4 py-10">
			<div className="w-full max-w-md rounded-card border border-border bg-card p-6 shadow-card sm:p-8">
				<Link
					to="/"
					className="font-display text-brand-primary text-lg tracking-tight"
				>
					DextaLearning
				</Link>

				{isPending ? (
					<div className="mt-8 flex flex-col items-center gap-3 py-8">
						<div className="size-12 animate-pulse rounded-full bg-muted" />
						<p className="text-muted-foreground text-sm">
							{t("cert_verify.checking", {
								defaultValue: "Checking this certificate…",
							})}
						</p>
					</div>
				) : data?.valid ? (
					<div className="mt-6">
						<div className="flex items-center gap-2 rounded-btn bg-success/10 px-3 py-2 text-success">
							<ShieldCheck className="size-5" />
							<span className="font-semibold text-sm">
								{t("cert_verify.valid", {
									defaultValue: "Verified certificate",
								})}
							</span>
						</div>

						<div className="mt-6 text-center">
							<BadgeCheck className="mx-auto size-12 text-brand-primary" />
							<p className="mt-4 text-muted-foreground text-sm">
								{t("cert_verify.awarded_to", {
									defaultValue: "This certificate was awarded to",
								})}
							</p>
							<p className="mt-1 font-display text-2xl text-foreground">
								{data.learnerName}
							</p>
							<p className="mt-4 text-muted-foreground text-sm">
								{t("cert_verify.for_completing", {
									defaultValue: "for completing the {{type}}",
									type: TYPE_LABEL[data.contentType ?? "course"] ?? "Course",
								})}
							</p>
							<p className="mt-1 font-semibold text-brand-primary text-lg">
								{data.contentTitle}
							</p>
							<p className="mt-6 text-muted-foreground text-xs">
								{t("cert_verify.issued_on", {
									defaultValue: "Issued on {{date}}",
									date: new Date(data.issuedAt).toLocaleDateString(undefined, {
										day: "numeric",
										month: "long",
										year: "numeric",
									}),
								})}
							</p>
						</div>
					</div>
				) : (
					<div className="mt-6 text-center">
						<div className="flex items-center justify-center gap-2 rounded-btn bg-destructive/10 px-3 py-2 text-destructive">
							<ShieldAlert className="size-5" />
							<span className="font-semibold text-sm">
								{t("cert_verify.invalid", {
									defaultValue: "Certificate not found",
								})}
							</span>
						</div>
						<p className="mt-6 text-muted-foreground text-sm">
							{t("cert_verify.invalid_body", {
								defaultValue:
									"We couldn't find a certificate for this code. Please check the link or QR code and try again.",
							})}
						</p>
					</div>
				)}
			</div>
		</main>
	);
}
