import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
	findCohortIdByTitle,
	promoteToAdmin,
	seedBareCourse,
	setCohortStartDate,
	verifyUserEmail,
} from "./support/db";

const PASSWORD = "TestPass123!";

test("admin creates a cohort, sets a start date, attaches a course, and opens it", async ({
	page,
}) => {
	const email = `e2e-${randomUUID()}@example.com`;
	const cohortTitle = `E2E Cohort ${randomUUID().slice(0, 8)}`;
	const { title: courseTitle } = await seedBareCourse();

	await page.goto("/register");
	await page.getByLabel("First name").fill("Ije");
	await page.getByLabel("Last name").fill("Nwosu");
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

	await page.goto("/admin/cohorts/");
	await page.getByRole("button", { name: "New cohort" }).first().click();
	await page.getByPlaceholder("Cohort title").fill(cohortTitle);
	await page.getByRole("button", { name: "Create cohort" }).click();
	await page.getByRole("link", { name: new RegExp(cohortTitle) }).click();

	// starts_at is required to open a cohort (COHORT_NOT_PUBLISHABLE gate) —
	// seeded directly rather than driving the settings form's date picker,
	// same simplification as the transcript/body-html shortcuts elsewhere.
	const cohortId = await findCohortIdByTitle(cohortTitle);
	await setCohortStartDate(cohortId);
	await page.reload();

	const courseSelect = page
		.getByRole("combobox")
		.filter({ has: page.getByRole("option", { name: courseTitle }) });
	await courseSelect.selectOption({ label: courseTitle });
	await page.getByRole("button", { name: "Add course" }).click();
	await expect(page.getByText(courseTitle)).toBeVisible();

	await page.getByRole("button", { name: "Open" }).click();
	await expect(page.getByText("Cohort opened")).toBeVisible();
});
