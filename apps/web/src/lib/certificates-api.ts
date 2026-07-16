import { apiFetch } from "./api";

/**
 * Certificates client (§5.8). Verification is public (the QR/URL target);
 * listing + download are for the signed-in owner.
 */

export type CertificateVerification =
	| {
			valid: true;
			learnerName: string | null;
			contentTitle: string | null;
			contentType: "course" | "path" | "cohort" | null;
			issuedAt: string;
	  }
	| { valid: false };

export interface MyCertificate {
	id: string;
	entityType: "course" | "path" | "cohort" | null;
	entityId: string | null;
	contentTitle: string | null;
	issuedAt: string;
	verifyToken: string;
}

export const certificateKeys = {
	mine: ["certificates", "mine"] as const,
	verify: (token: string) => ["certificates", "verify", token] as const,
};

export const verifyCertificate = (token: string) =>
	apiFetch<CertificateVerification>(`/certificates/verify/${token}`);

export const getMyCertificates = () =>
	apiFetch<MyCertificate[]>("/certificates/mine");

/** Fetch a fresh signed (2h) download URL, then open it. */
export async function downloadCertificate(id: string): Promise<void> {
	const { url } = await apiFetch<{ url: string }>(
		`/certificates/${id}/download`,
	);
	window.open(url, "_blank", "noopener");
}
