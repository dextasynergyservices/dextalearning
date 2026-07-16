import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
	getAttemptMonitoring,
	seedCameraAssessment,
	verifyUserEmail,
} from "./support/db";

const PASSWORD = "TestPass123!";

/** Where TF.js fetches the face-landmark model weights from. */
const MODEL_HOSTS = /tfhub\.dev|storage\.googleapis\.com|jsdelivr|unpkg\.com/i;

/**
 * §4.6.2.1 — the monitor can fail to load, and a learner can *make* it fail by
 * blocking one request in devtools. That path used to be silent: the badge said
 * "Monitored", nothing was recorded, and the attempt scored a clean 100/100 —
 * indistinguishable from a watched, honest exam, and invisible to the Admin
 * integrity queue (which filters `integrity_score < 100`).
 *
 * This drives the exploit for real: abort the model fetch, then assert we say so
 * on screen AND put it on the record.
 */
test("a blocked face-detection model is reported, not silently ignored", async ({
	page,
}) => {
	// The client retries 3× with backoff before giving up (~6s), and the model
	// fetch is slow even when it fails.
	test.setTimeout(120_000);

	const { assessmentId } = await seedCameraAssessment();
	const email = `e2e-${randomUUID()}@example.com`;

	await page.goto("/register");
	await page.getByLabel("First name").fill("Bisi");
	await page.getByLabel("Last name").fill("Adeyemi");
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

	// The exploit: kill the model download the way a learner with devtools would.
	await page.route(MODEL_HOSTS, (route) => route.abort());

	await page.goto(`/learn/assessment/${assessmentId}`);

	const unavailableReport = page.waitForRequest(
		(req) =>
			req.url().includes("/anti-cheat") &&
			req.method() === "POST" &&
			(req.postData() ?? "").includes("camera_monitor_unavailable"),
		{ timeout: 90_000 },
	);
	await page.getByRole("button", { name: "Enable camera & start" }).click();

	// 1. The learner is told the truth, rather than shown a reassuring lie.
	await expect(page.getByText("Monitoring unavailable")).toBeVisible({
		timeout: 90_000,
	});
	await expect(page.getByText("Monitored", { exact: true })).toBeHidden();

	// 2. It reaches the server.
	await unavailableReport;

	// 3. It reaches the record — this is what stops a clean 100 being mistaken
	//    for a monitored, clean attempt.
	await expect
		.poll(
			async () => (await getAttemptMonitoring(assessmentId))?.cameraMonitored,
			{
				timeout: 15_000,
			},
		)
		.toBe(false);

	// 4. And it costs the learner nothing: our CDN failing is not their conduct.
	const state = await getAttemptMonitoring(assessmentId);
	expect(state?.integrityScore).toBe(100);
});
