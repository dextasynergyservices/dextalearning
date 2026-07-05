import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
	promoteToAdmin,
	seedCohort,
	seedFeatureRequestCourse,
	verifyUserEmail,
} from "./support/db";

const PASSWORD = "TestPass123!";

async function registerAndLoginAsAdmin(
	page: import("@playwright/test").Page,
): Promise<void> {
	const email = `e2e-${randomUUID()}@example.com`;

	await page.goto("/register");
	await page.getByLabel("First name").fill("Ngozi");
	await page.getByLabel("Last name").fill("Eze");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByLabel("Confirm password").fill(PASSWORD);
	await page.getByRole("button", { name: "Create account" }).click();
	await expect(page).toHaveURL(/\/verify-email/);
	await verifyUserEmail(email);
	await promoteToAdmin(email);

	await page.goto("/login");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL(/\/admin/);
}

test("admin approves a feature request", async ({ page }) => {
	const { title } = await seedFeatureRequestCourse();
	await registerAndLoginAsAdmin(page);

	await page.goto("/admin/");
	// title → its wrapping "min-w-0 flex-1" span → the row div, which also
	// holds the Feature/Dismiss buttons as siblings (admin/index.tsx's
	// FeatureRequests list item markup).
	const row = page
		.getByText(title, { exact: true })
		.locator("..")
		.locator("..");
	await row.getByRole("button", { name: "Feature" }).click();

	// The course legitimately keeps appearing elsewhere on the dashboard (e.g.
	// "Recent content") once featured — only the pending queue should empty,
	// and `FeatureRequests` unmounts itself entirely once it does
	// (admin/index.tsx: `if (pending.length === 0) return null`).
	await expect(page.getByText("Feature requests")).not.toBeVisible();
});

test("admin saves cohort settings", async ({ page }) => {
	const { cohortId } = await seedCohort();
	await registerAndLoginAsAdmin(page);

	await page.goto(`/admin/cohorts/${cohortId}`);
	await expect(page.getByText("Cohort settings")).toBeVisible();

	await page.getByRole("button", { name: "Save settings" }).click();
	await expect(page.getByText("Settings saved")).toBeVisible();
});
