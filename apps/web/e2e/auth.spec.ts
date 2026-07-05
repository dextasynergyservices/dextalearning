import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { verifyUserEmail } from "./support/db";

const PASSWORD = "TestPass123!";

function uniqueEmail(): string {
	return `e2e-${randomUUID()}@example.com`;
}

test("register → verify (DB shortcut) → login → sign out", async ({ page }) => {
	const email = uniqueEmail();

	await page.goto("/register");
	await page.getByLabel("First name").fill("Ada");
	await page.getByLabel("Last name").fill("Lovelace");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByLabel("Confirm password").fill(PASSWORD);
	await page.getByRole("button", { name: "Create account" }).click();

	await expect(page).toHaveURL(/\/verify-email/);

	// No real inbox in dev (no RESEND_API_KEY) — flip the DB flag directly,
	// same shortcut the API's own e2e suite uses.
	await verifyUserEmail(email);

	await page.goto("/login");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();

	// login.tsx hard-navigates via window.location.assign after confirming the
	// session, so this waits for a real page load, not a client-side route change.
	await page.waitForURL(/\/dashboard/);

	await page.getByLabel("Account menu").click();
	await page.getByRole("menuitem", { name: "Sign out" }).click();

	await expect(page).toHaveURL("/");
});

test("registering an existing email shows a sign-in nudge instead of an error", async ({
	page,
}) => {
	const email = uniqueEmail();

	async function register() {
		await page.goto("/register");
		await page.getByLabel("First name").fill("Chinwe");
		await page.getByLabel("Last name").fill("Okafor");
		await page.getByLabel("Email").fill(email);
		await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
		await page.getByLabel("Confirm password").fill(PASSWORD);
		await page.getByRole("button", { name: "Create account" }).click();
	}

	await register();
	await expect(page).toHaveURL(/\/verify-email/);

	await register();
	await expect(
		page.getByText("This email already has an account"),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Sign in instead →" }),
	).toBeVisible();
});
