import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { getEmailOtp, isOnboarded } from "./support/db";

const PASSWORD = "TestPass123!";

test("instructor verifies with a real OTP and completes onboarding", async ({
	page,
}) => {
	const email = `e2e-${randomUUID()}@example.com`;

	await page.goto("/register");
	await page.getByLabel("First name").fill("Nadia");
	await page.getByLabel("Last name").fill("Ibrahim");
	await page.getByRole("button", { name: "Instructor" }).click();
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByLabel("Confirm password").fill(PASSWORD);
	await page.getByRole("button", { name: "Create account" }).click();
	await expect(page).toHaveURL(/\/verify-email/);

	// Real 6-digit code, read back from Better Auth's own verifications table
	// (dev mode never delivers real email) — driving the actual form here,
	// not the DB-shortcut auth.spec.ts uses.
	const otp = await getEmailOtp(email, "email-verification-otp");
	await page.getByLabel("Verification code").fill(otp);
	await page.getByRole("button", { name: "Verify email" }).click();

	// Verifying alone doesn't establish a session (confirmed: landing on
	// /onboarding right after verify-email's own navigation renders the
	// LEARNER wizard even for an instructor account, since onboarding.tsx's
	// role check sees no session yet) — log in for real first, then navigate
	// to /onboarding directly with an actual instructor session active.
	await page.goto("/login");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL(/\/instructor/);

	await page.goto("/onboarding");

	// Step 1: welcome
	await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
	await page.getByRole("button", { name: "Continue" }).click();

	// Step 2: profile (all fields optional)
	await page.getByLabel("Headline").fill("I teach frontend engineering");
	await page.getByRole("button", { name: "Continue" }).click();

	// Step 3: orientation → finish
	await page.getByRole("button", { name: "Enter the Studio" }).click();

	await page.waitForURL(/\/instructor/);

	// The redirect happens in a `finally` block regardless of whether the save
	// API call actually succeeded — check the real outcome, not just the URL.
	await expect.poll(() => isOnboarded(email)).toBe(true);
});
