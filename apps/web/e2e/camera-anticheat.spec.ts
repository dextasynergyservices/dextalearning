import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { seedCameraAssessment, verifyUserEmail } from "./support/db";

const PASSWORD = "TestPass123!";

test("camera-required assessment flags a missing face via real client-side detection", async ({
	page,
}) => {
	/**
	 * Measured, not guessed: headless Chromium has no GPU, so TF.js logs
	 * "Initialization of backend webgl failed" and falls back to CPU, where a
	 * single `estimateFaces` costs seconds. This spec is also the pathological
	 * case — a fake camera with NO face, ever — so every tick runs the full
	 * 4-sample confirm loop (§4.6.2) rather than exiting on the first clean
	 * look. Click→flag measured at ~53s (login+nav was only 4.5s of it).
	 *
	 * `test.slow()` (90s) sat right on that edge and flaked. This is a property
	 * of the environment, not the app: a real learner with a face in frame pays
	 * ONE inference per tick.
	 */
	test.setTimeout(240_000);
	const { assessmentId } = await seedCameraAssessment();
	const email = `e2e-${randomUUID()}@example.com`;

	await page.goto("/register");
	await page.getByLabel("First name").fill("Amara");
	await page.getByLabel("Last name").fill("Chukwu");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByLabel("Confirm password").fill(PASSWORD);
	await page.getByRole("button", { name: "Create account" }).click();
	await expect(page).toHaveURL(/\/verify-email/);
	await verifyUserEmail(email);

	await page.goto("/login");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL(/\/dashboard/);

	await page.goto(`/learn/assessment/${assessmentId}`);

	// Playwright's fake video device (configured in playwright.config.ts) has
	// no face, so CameraMonitor's real TensorFlow.js face-landmark detection
	// (camera-monitor.tsx) should flag "0 faces" and POST a real proctoring
	// event — this is genuine anti-cheat business logic, not a rendering check.
	const proctoringRequest = page.waitForResponse(
		(res) =>
			res.url().includes("/proctoring") && res.request().method() === "POST",
		// Must also be raised: this inner wait — not the test timeout — is what
		// actually caps how long we'll wait for the flag.
		{ timeout: 200_000 },
	);
	await page.getByRole("button", { name: "Enable camera & start" }).click();
	await proctoringRequest;

	await page.getByRole("button", { name: "4" }).click();
	await page.getByRole("button", { name: "Submit" }).click();

	// Only rendered when flagCount > 0 (learn/assessment/$assessmentId.tsx
	// ResultView) — proves the flag reached grading, not just the network call.
	await expect(page.getByText(/Integrity score \d+\/100/)).toBeVisible();
});
