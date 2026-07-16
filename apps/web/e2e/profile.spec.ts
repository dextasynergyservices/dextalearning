import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { verifyUserEmail } from "./support/db";

const PASSWORD = "TestPass123!";

// Minimal valid 1x1 transparent PNG — avatar upload just needs a real
// image/png buffer, no ffmpeg-generated fixture required for this one.
const TINY_PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
	"base64",
);

test("learner edits their profile and uploads a real avatar", async ({
	page,
}) => {
	const email = `e2e-${randomUUID()}@example.com`;

	await page.goto("/register");
	await page.getByLabel("First name").fill("Yewande");
	await page.getByLabel("Last name").fill("Bakare");
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

	await page.goto("/profile");
	await page.getByLabel("Last name").fill("Bakare-Johnson");
	await page.getByPlaceholder("+234 800 000 0000").fill("+2348012345678");
	// The page has TWO "Save changes" buttons — Account and Learning reminders
	// (added with the §3.2 reminders section). Both fire the same mutation with
	// the whole form, so either saves everything; take the one beside the fields
	// we just edited rather than tripping strict mode.
	await page.getByRole("button", { name: "Save changes" }).first().click();
	await expect(page.getByText("Profile saved.")).toBeVisible();

	// Real, not stubbed: phone verification has no actual send/verify flow
	// anywhere in the API (confirmed via investigation) — changing the phone
	// number correctly keeps showing "Not verified", never flips to verified
	// client-side.
	await expect(page.getByText("Not verified")).toBeVisible();

	await page.locator('input[type="file"]').setInputFiles({
		name: "avatar.png",
		mimeType: "image/png",
		buffer: TINY_PNG,
	});
	await expect(page.getByText("Photo updated.")).toBeVisible();
});
