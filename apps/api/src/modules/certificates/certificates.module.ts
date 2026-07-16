import { Module, type Provider } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { CERTIFICATE_RENDERER } from "./certificate-renderer.port";
import { CertificatesController } from "./certificates.controller";
import { CertificatesEventsHandler } from "./certificates.events-handler";
import { CertificatesService } from "./certificates.service";
import { FakeCertificateRenderer } from "./renderers/fake.renderer";
import { PuppeteerCertificateRenderer } from "./renderers/puppeteer.renderer";

/**
 * Certificates bounded context (§5.8). Issues + verifies branded PDF
 * certificates on completion. The renderer is chosen at boot: the Fake (no
 * Chromium) under test or when `CERTIFICATES_RENDERER=fake`, else Puppeteer —
 * so tests/e2e never launch a headless browser. Prisma + Storage are global.
 */
const useFake =
	process.env.NODE_ENV === "test" ||
	process.env.CERTIFICATES_RENDERER === "fake";

const rendererProvider: Provider = {
	provide: CERTIFICATE_RENDERER,
	useClass: useFake ? FakeCertificateRenderer : PuppeteerCertificateRenderer,
};

@Module({
	imports: [NotificationsModule],
	controllers: [CertificatesController],
	providers: [CertificatesService, CertificatesEventsHandler, rendererProvider],
	exports: [CertificatesService],
})
export class CertificatesModule {}
