import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { seedLearnerPath, verifyUserEmail } from "./support/db";

const PASSWORD = "TestPass123!";

test("learner enrols in a path, opens its course, and reads the lesson", async ({
	page,
}) => {
	const { pathSlug, lessonId } = await seedLearnerPath();
	const email = `e2e-${randomUUID()}@example.com`;

	await page.goto("/register");
	await page.getByLabel("First name").fill("Halima");
	await page.getByLabel("Last name").fill("Sani");
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

	await page.goto(`/teachers/paths/${pathSlug}`);
	await page.getByRole("button", { name: "Enrol now" }).click();
	await expect(
		page.getByRole("link", { name: "Start learning" }),
	).toBeVisible();
	await page.getByRole("link", { name: "Start learning" }).click();

	// Path hub: real progress data (0/1 courses), course row links into the
	// course's own learn hub — same destination the course-only golden path
	// (learner.spec.ts) already exercises from here on.
	await expect(page.getByText("0/1 courses complete")).toBeVisible();
	await expect(page.getByText("HTML Basics")).toBeVisible();

	await page.goto(`/learn/lesson/${lessonId}`);
	await expect(
		page.getByRole("heading", { name: "Tags and elements" }),
	).toBeVisible();
	await expect(page.getByText("HTML is made of tags.")).toBeVisible();
});
