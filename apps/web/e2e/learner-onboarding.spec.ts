import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { getEmailOtp, isOnboarded } from "./support/db";

const PASSWORD = "TestPass123!";

test("learner verifies with a real OTP and completes the full onboarding wizard", async ({
	page,
}) => {
	const email = `e2e-${randomUUID()}@example.com`;

	await page.goto("/register");
	await page.getByLabel("First name").fill("Amaka");
	await page.getByLabel("Last name").fill("Obi");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByLabel("Confirm password").fill(PASSWORD);
	await page.getByRole("button", { name: "Create account" }).click();
	await expect(page).toHaveURL(/\/verify-email/);

	const otp = await getEmailOtp(email, "email-verification-otp");
	await page.getByLabel("Verification code").fill(otp);
	await page.getByRole("button", { name: "Verify email" }).click();

	// Same finding as onboarding.spec.ts (instructor): verifying alone doesn't
	// establish a session, so a real login is needed before the wizard's role
	// check (or here, any of it) reflects the real signed-in user.
	await page.goto("/login");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL(/\/dashboard/);

	await page.goto("/onboarding");

	// Step 1: language (never gates Continue)
	await page.getByRole("button", { name: "English" }).click();
	await page.getByRole("button", { name: "Continue" }).click();

	// Step 2: goals (checkbox, needs at least one)
	await page.getByRole("button", { name: "Grow my career" }).click();
	await page.getByRole("button", { name: "Continue" }).click();

	// Step 3: level (radio)
	await page.getByRole("button", { name: "Beginner" }).click();
	await page.getByRole("button", { name: "Continue" }).click();

	// Step 4: hours (radio)
	await page.getByRole("button", { name: "1–2 hours" }).click();
	await page.getByRole("button", { name: "Continue" }).click();

	// Step 5: schedule (radio)
	await page.getByRole("button", { name: "Mornings" }).click();
	await page.getByRole("button", { name: "Continue" }).click();

	// Step 6: WhatsApp (optional — phone + opt-in never gate Continue) → finish
	await page.getByRole("button", { name: "Finish setup" }).click();

	// Finishing lands on an in-page Activation screen (recommended courses),
	// not a direct navigate — the real CTA takes the learner to /dashboard.
	await page.getByRole("button", { name: "Go to my dashboard" }).click();
	await page.waitForURL(/\/dashboard/);

	// The save call is fire-and-forget (errors don't block finishing) — check
	// the real DB outcome, not just that the wizard let us through.
	await expect.poll(() => isOnboarded(email)).toBe(true);
});
