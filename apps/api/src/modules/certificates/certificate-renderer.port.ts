/**
 * Certificate renderer port (§5.8, §6.4). The Certificates context depends on
 * this interface, not on Puppeteer directly — so PDF generation is swappable
 * and tests/dev run without launching a headless Chromium. The real adapter is
 * Handlebars + QR + Puppeteer; a Fake returns a tiny placeholder PDF.
 */
export const CERTIFICATE_RENDERER = Symbol("CERTIFICATE_RENDERER");

export interface CertificateData {
	learnerName: string;
	contentTitle: string;
	/** "Course" | "Learning Path" | "Cohort" — display label. */
	contentTypeLabel: string;
	/** Localised issue date, already formatted. */
	issuedDate: string;
	/** Public verification URL encoded into the QR code. */
	verifyUrl: string;
	/** Short human-readable verification id shown as text under the QR. */
	verifyToken: string;
	platformName: string;
}

export interface CertificateRendererPort {
	/** Render a branded certificate to PDF bytes. */
	render(data: CertificateData): Promise<Buffer>;
}
