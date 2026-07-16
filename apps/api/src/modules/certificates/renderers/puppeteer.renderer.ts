import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import Handlebars from "handlebars";
import type { Browser } from "puppeteer";
import puppeteer from "puppeteer";
import QRCode from "qrcode";
import type {
	CertificateData,
	CertificateRendererPort,
} from "../certificate-renderer.port";
import { CERTIFICATE_TEMPLATE } from "../certificate-template";

/**
 * Puppeteer certificate renderer (§5.8) — pixel-perfect PDF from the branded
 * Handlebars template + an embedded QR data URI. Reuses ONE headless browser
 * across renders (launching Chromium per certificate is far too slow) and
 * closes it on shutdown. `--no-sandbox` is required in the container.
 */
@Injectable()
export class PuppeteerCertificateRenderer
	implements CertificateRendererPort, OnModuleDestroy
{
	private readonly logger = new Logger(PuppeteerCertificateRenderer.name);
	private readonly template = Handlebars.compile(CERTIFICATE_TEMPLATE);
	private browserPromise?: Promise<Browser>;

	private browser(): Promise<Browser> {
		if (!this.browserPromise) {
			this.browserPromise = puppeteer.launch({
				headless: true,
				args: ["--no-sandbox", "--disable-setuid-sandbox"],
			});
		}
		return this.browserPromise;
	}

	async render(data: CertificateData): Promise<Buffer> {
		const qrDataUri = await QRCode.toDataURL(data.verifyUrl, {
			margin: 1,
			width: 240,
		});
		const html = this.template({ ...data, qrDataUri });

		const browser = await this.browser();
		const page = await browser.newPage();
		try {
			await page.setContent(html, { waitUntil: "load" });
			// Ensure the Google-Fonts webfonts are applied before printing.
			await page.evaluate(() => document.fonts.ready);
			const pdf = await page.pdf({
				format: "A4",
				landscape: true,
				printBackground: true,
			});
			return Buffer.from(pdf);
		} finally {
			await page.close();
		}
	}

	async onModuleDestroy(): Promise<void> {
		if (this.browserPromise) {
			try {
				await (await this.browserPromise).close();
			} catch (error) {
				this.logger.warn(`Browser close failed: ${String(error)}`);
			}
		}
	}
}
