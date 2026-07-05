import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
	findUserIdByEmail,
	promoteToAdmin,
	seedBareCourse,
	verifyUserEmail,
} from "./support/db";

const PASSWORD = "TestPass123!";

test("instructor creates an assessment, adds an MCQ question, and deletes it", async ({
	page,
}) => {
	const email = `e2e-${randomUUID()}@example.com`;

	await page.goto("/register");
	await page.getByLabel("First name").fill("Kelechi");
	await page.getByLabel("Last name").fill("Uche");
	await page.getByRole("button", { name: "Instructor" }).click();
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByLabel("Confirm password").fill(PASSWORD);
	await page.getByRole("button", { name: "Create account" }).click();
	await expect(page).toHaveURL(/\/verify-email/);
	await verifyUserEmail(email);

	const instructorId = await findUserIdByEmail(email);
	const { courseId } = await seedBareCourse(instructorId);

	await page.goto("/login");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL(/\/instructor/);

	// AssessmentLauncher (embedded in the course editor) creates an empty
	// assessment via one API call and navigates straight into its editor —
	// there's no standalone "create assessment" route.
	await page.goto(`/instructor/courses/${courseId}`);
	await page.getByRole("button", { name: "Create final assessment" }).click();
	await page.waitForURL(/\/instructor\/assessments\//);

	await page.getByRole("button", { name: "Add question" }).click();
	await page
		.getByLabel("Question", { exact: true })
		.fill("Which technique spreads study sessions over time?");
	const options = page.getByPlaceholder(/Option \d/);
	await options.nth(0).fill("Cramming");
	await options.nth(1).fill("Spaced repetition");
	// Mark the SECOND option correct — not a radio input, a real toggle button.
	await page.getByRole("button", { name: "Mark correct" }).nth(1).click();
	await page.getByRole("button", { name: "Save question" }).click();

	await expect(
		page.getByText("Which technique spreads study sessions over time?"),
	).toBeVisible();

	// Header "Delete" and the confirm dialog's own button share the same
	// accessible name — same shared ConfirmDialog pattern as courses/cohorts.
	await page.getByRole("button", { name: "Delete" }).first().click();
	await expect(page.getByText("Delete assessment?")).toBeVisible();
	const deleteButtons = page.getByRole("button", { name: "Delete" });
	await deleteButtons.last().click();

	// Deleting an assessment navigates to the bare courses list, not back to
	// the course it belonged to.
	await page.waitForURL(/\/instructor\/courses$/);
});

test("admin creates an assessment for an ownerless course and adds a question", async ({
	page,
}) => {
	const email = `e2e-${randomUUID()}@example.com`;

	await page.goto("/register");
	await page.getByLabel("First name").fill("Ifeoma");
	await page.getByLabel("Last name").fill("Chukwu");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByLabel("Confirm password").fill(PASSWORD);
	await page.getByRole("button", { name: "Create account" }).click();
	await expect(page).toHaveURL(/\/verify-email/);
	await verifyUserEmail(email);
	await promoteToAdmin(email);

	// No owner — only an admin (bypasses per-resource ownership entirely)
	// could reach this course's assessment launcher at all.
	const { courseId } = await seedBareCourse();

	await page.goto("/login");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL(/\/admin/);

	await page.goto(`/admin/courses/${courseId}`);
	await page.getByRole("button", { name: "Create final assessment" }).click();
	await page.waitForURL(/\/admin\/assessments\//);

	await page.getByRole("button", { name: "Add question" }).click();
	await page
		.getByLabel("Question", { exact: true })
		.fill("Two plus two equals?");
	const options = page.getByPlaceholder(/Option \d/);
	await options.nth(0).fill("3");
	await options.nth(1).fill("4");
	await page.getByRole("button", { name: "Mark correct" }).nth(1).click();
	await page.getByRole("button", { name: "Save question" }).click();

	await expect(page.getByText("Two plus two equals?")).toBeVisible();
});
