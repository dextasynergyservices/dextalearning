import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { getMagicLinkToken, verifyUserEmail } from "./support/db";

const PASSWORD = "TestPass123!";

test("signs in via a real magic link instead of a password", async ({
	page,
}) => {
	const email = `e2e-${randomUUID()}@example.com`;

	await page.goto("/register");
	await page.getByLabel("First name").fill("Bimpe");
	await page.getByLabel("Last name").fill("Ogun");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByLabel("Confirm password").fill(PASSWORD);
	await page.getByRole("button", { name: "Create account" }).click();
	await expect(page).toHaveURL(/\/verify-email/);
	await verifyUserEmail(email);

	await page.goto("/login");
	await page.getByLabel("Email").fill(email);
	await page.getByRole("button", { name: "Email me a sign-in link" }).click();
	await expect(
		page.getByText("Sign-in link sent — check your email."),
	).toBeVisible();

	// Real magic-link token, read back from Better Auth's verifications table
	// (dev mode never delivers real email) — visiting the verify URL directly
	// is the same thing clicking the real emailed link would do.
	const token = await getMagicLinkToken(email);
	const callbackURL = encodeURIComponent("http://localhost:5173/continue");
	await page.goto(
		`http://localhost:3000/api/auth/magic-link/verify?token=${token}&callbackURL=${callbackURL}`,
	);

	// /continue is the role resolver every non-password-login flow lands on
	// (magic-link, OAuth) — it hard-navigates to the role home once the
	// session is confirmed.
	await page.waitForURL(/\/dashboard/);
});
