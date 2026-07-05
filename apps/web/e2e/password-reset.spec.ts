import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { getEmailOtp, verifyUserEmail } from "./support/db";

const OLD_PASSWORD = "TestPass123!";
const NEW_PASSWORD = "NewPassword456!";

test("resets a forgotten password via a real OTP and signs in with the new one", async ({
	page,
}) => {
	const email = `e2e-${randomUUID()}@example.com`;

	await page.goto("/register");
	await page.getByLabel("First name").fill("Segun");
	await page.getByLabel("Last name").fill("Adekunle");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(OLD_PASSWORD);
	await page.getByLabel("Confirm password").fill(OLD_PASSWORD);
	await page.getByRole("button", { name: "Create account" }).click();
	await expect(page).toHaveURL(/\/verify-email/);
	await verifyUserEmail(email);

	await page.goto("/login");
	await page.getByRole("link", { name: "Forgot password?" }).click();
	// Wait for the real forgot-password content, not just the URL — the URL
	// can update via SPA navigation slightly before the new route's form has
	// actually mounted, and a fill() during that gap can land on nothing.
	await expect(
		page.getByText("Enter your email and we'll send you a reset link."),
	).toBeVisible();

	const emailField = page.getByLabel("Email");
	await emailField.fill(email);
	await expect(emailField).toHaveValue(email);
	await page.getByRole("button", { name: "Send reset link" }).click();
	await page.waitForURL(/\/reset-password/);

	// Real 6-digit code, read back from Better Auth's verifications table —
	// same reasoning as onboarding.spec.ts's getEmailOtp use (dev mode never
	// delivers real email, and the log line doesn't include the code).
	const otp = await getEmailOtp(email, "forget-password-otp");
	await page.getByLabel("Reset code").fill(otp);
	await page.getByLabel("New password").fill(NEW_PASSWORD);
	await page.getByLabel("Confirm password").fill(NEW_PASSWORD);
	await page.getByRole("button", { name: "Update password" }).click();

	await expect(
		page.getByText("Password updated — sign in with your new password."),
	).toBeVisible();
	await page.waitForURL(/\/login/);

	// Prove the reset actually took effect server-side, not just a success
	// toast: the OLD password must no longer work, the NEW one must.
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(NEW_PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL(/\/dashboard/);
});
