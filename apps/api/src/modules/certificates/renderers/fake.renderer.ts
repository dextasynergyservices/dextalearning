import { Injectable } from "@nestjs/common";
import type {
	CertificateData,
	CertificateRendererPort,
} from "../certificate-renderer.port";

/**
 * Fake certificate renderer (§6.4) — used in tests/dev (and any environment
 * without a headless Chromium) so the whole issue → store → verify flow runs
 * without launching Puppeteer. Returns a minimal but valid PDF whose text
 * carries the learner + content so assertions can inspect it.
 */
@Injectable()
export class FakeCertificateRenderer implements CertificateRendererPort {
	async render(data: CertificateData): Promise<Buffer> {
		const text = `Certificate: ${data.learnerName} - ${data.contentTitle} (${data.verifyToken})`;
		// A tiny hand-rolled single-page PDF containing the text.
		const body = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 842 595]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${text.length + 40}>>stream
BT /F1 18 Tf 40 540 Td (${text.replace(/[()\\]/g, " ")}) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`;
		return Buffer.from(body, "utf8");
	}
}
