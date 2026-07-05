import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { seedCameraAssessment, verifyUserEmail } from "./support/db";

const PASSWORD = "TestPass123!";

test("camera-required assessment flags a missing face via real client-side detection", async ({
	page,
}) => {
	test.slow(); // real TensorFlow.js model download + inference, not instant
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
		{ timeout: 90_000 },
	);
	await page.getByRole("button", { name: "Enable camera & start" }).click();
	await proctoringRequest;

	await page.getByRole("button", { name: "4" }).click();
	await page.getByRole("button", { name: "Submit" }).click();

	// Only rendered when flagCount > 0 (learn/assessment/$assessmentId.tsx
	// ResultView) — proves the flag reached grading, not just the network call.
	await expect(page.getByText(/Integrity score \d+\/100/)).toBeVisible();
});
