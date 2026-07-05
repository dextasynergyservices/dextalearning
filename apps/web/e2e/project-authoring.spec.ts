import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
	findUserIdByEmail,
	promoteToAdmin,
	seedBareCourse,
	verifyUserEmail,
} from "./support/db";

const PASSWORD = "TestPass123!";

test("instructor creates a project, edits its rubric and submission types, and deletes it", async ({
	page,
}) => {
	const email = `e2e-${randomUUID()}@example.com`;
	const projectTitle = `E2E Project ${randomUUID().slice(0, 8)}`;

	await page.goto("/register");
	await page.getByLabel("First name").fill("Tobi");
	await page.getByLabel("Last name").fill("Fashola");
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

	// ProjectsSection (embedded in the course editor) creates the row via one
	// inline "New project title…" + "Add project" submit and redirects
	// straight into the full editor — same pattern as courses/paths/cohorts.
	await page.goto(`/instructor/courses/${courseId}`);
	await page.getByPlaceholder("New project title…").fill(projectTitle);
	await page.getByRole("button", { name: "Add project" }).click();
	await page.waitForURL(/\/instructor\/projects\//);

	// Toggle an additional accepted submission type (real button, not a checkbox).
	await page.getByRole("button", { name: "Text" }).click();
	await page.getByLabel("Grading").selectOption({ label: "Manual" });

	await page.getByRole("button", { name: "Add criterion" }).click();
	await page
		.getByPlaceholder("Criterion (e.g. Code quality)")
		.fill("Code quality");
	await expect(page.getByText("10 pts")).toBeVisible();

	await page.getByRole("button", { name: "Save project" }).click();
	await expect(page.getByText("Project saved")).toBeVisible();

	await page.getByRole("button", { name: "Delete" }).first().click();
	await expect(page.getByText("Delete project?")).toBeVisible();
	const deleteButtons = page.getByRole("button", { name: "Delete" });
	await deleteButtons.last().click();

	// Deleting a project navigates to the bare courses list, not back to the
	// course it belonged to.
	await page.waitForURL(/\/instructor\/courses$/);
});

test("admin creates a project for an ownerless course and saves its rubric", async ({
	page,
}) => {
	const email = `e2e-${randomUUID()}@example.com`;
	const projectTitle = `E2E Admin Project ${randomUUID().slice(0, 8)}`;

	await page.goto("/register");
	await page.getByLabel("First name").fill("Ngozi");
	await page.getByLabel("Last name").fill("Ike");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByLabel("Confirm password").fill(PASSWORD);
	await page.getByRole("button", { name: "Create account" }).click();
	await expect(page).toHaveURL(/\/verify-email/);
	await verifyUserEmail(email);
	await promoteToAdmin(email);

	// No owner — only an admin (bypasses per-resource ownership entirely)
	// could reach this course's project section at all.
	const { courseId } = await seedBareCourse();

	await page.goto("/login");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL(/\/admin/);

	await page.goto(`/admin/courses/${courseId}`);
	await page.getByPlaceholder("New project title…").fill(projectTitle);
	await page.getByRole("button", { name: "Add project" }).click();
	await page.waitForURL(/\/admin\/projects\//);

	await page.getByRole("button", { name: "Add criterion" }).click();
	await page
		.getByPlaceholder("Criterion (e.g. Code quality)")
		.fill("Overall quality");
	await page.getByRole("button", { name: "Save project" }).click();
	await expect(page.getByText("Project saved")).toBeVisible();
});
