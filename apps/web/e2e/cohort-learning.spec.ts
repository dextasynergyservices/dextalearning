import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { seedLearnerCohort, verifyUserEmail } from "./support/db";

const PASSWORD = "TestPass123!";

test("learner enrols in a cohort, opens its course, and reads the lesson", async ({
	page,
}) => {
	const { cohortSlug, lessonId } = await seedLearnerCohort();
	const email = `e2e-${randomUUID()}@example.com`;

	await page.goto("/register");
	await page.getByLabel("First name").fill("Chidera");
	await page.getByLabel("Last name").fill("Nnamdi");
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

	await page.goto(`/teachers/cohorts/${cohortSlug}`);
	await page.getByRole("button", { name: "Enrol now" }).click();
	await expect(
		page.getByRole("link", { name: "Start learning" }),
	).toBeVisible();
	await page.getByRole("link", { name: "Start learning" }).click();

	// Cohort hub: real progress data, course row links into the course's own
	// learn hub — same destination the course/path golden paths already use.
	await expect(page.getByText("0/1 courses complete")).toBeVisible();
	await expect(page.getByText("CSS Basics")).toBeVisible();

	await page.goto(`/learn/lesson/${lessonId}`);
	await expect(
		page.getByRole("heading", { name: "Selectors and properties" }),
	).toBeVisible();
	await expect(page.getByText("CSS styles HTML elements.")).toBeVisible();
});
