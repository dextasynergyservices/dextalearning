import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { verifyUserEmail } from "./support/db";
import { testVideoPath } from "./support/fixtures";

const PASSWORD = "TestPass123!";

// The real ffmpeg encoding pipeline (ffmpeg-encoder.adapter.ts) has zero
// coverage anywhere else — Phase C/D integration/e2e both swap in
// FakeMediaEncoderAdapter. This is its first real exercise: an actual file,
// an actual BullMQ job, actual background encoding.
test("instructor uploads a real video and the encoding pipeline processes it", async ({
	page,
}) => {
	test.slow(); // real background encoding, not instant — give this one more room
	const email = `e2e-${randomUUID()}@example.com`;
	const courseTitle = `E2E Media Course ${randomUUID().slice(0, 8)}`;
	const lessonTitle = `E2E Media Lesson ${randomUUID().slice(0, 8)}`;

	await page.goto("/register");
	await page.getByLabel("First name").fill("Obinna");
	await page.getByLabel("Last name").fill("Eze");
	await page.getByRole("button", { name: "Instructor" }).click();
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
	await page.waitForURL(/\/instructor/);

	await page.goto("/instructor/courses/");
	await page.getByRole("button", { name: "New course" }).first().click();
	await page.getByPlaceholder("Course title").fill(courseTitle);
	await page.getByRole("button", { name: "Create course" }).click();
	await page.getByRole("link", { name: new RegExp(courseTitle) }).click();

	await page.getByPlaceholder("Module title").fill("Getting started");
	await page.getByRole("button", { name: "Add module" }).click();
	await expect(page.getByText("Getting started")).toBeVisible();

	await page.getByPlaceholder("Lesson title").fill(lessonTitle);
	await page.getByRole("button", { name: "Add lesson" }).click();
	await page.getByRole("link", { name: new RegExp(lessonTitle) }).click();

	await page.getByRole("button", { name: "Video" }).click();
	await page.locator('input[type="file"]').first().setInputFiles(testVideoPath);

	await expect(page.getByText(/Uploading/)).toBeVisible();
	// EncodingStatusCard self-polls (1.5s) and the lesson editor auto-refreshes
	// once the BullMQ job reports "completed" — no manual reload/poll needed
	// here, just a generous timeout for the real ffmpeg job to finish.
	await expect(page.getByRole("button", { name: "Remove" })).toBeVisible({
		timeout: 60_000,
	});
});
