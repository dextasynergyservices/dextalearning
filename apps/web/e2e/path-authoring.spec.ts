import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
	findUserIdByEmail,
	seedBareCourse,
	verifyUserEmail,
} from "./support/db";

const PASSWORD = "TestPass123!";

test("instructor creates a path, attaches a course, and publishes it", async ({
	page,
}) => {
	const email = `e2e-${randomUUID()}@example.com`;
	const pathTitle = `E2E Path ${randomUUID().slice(0, 8)}`;

	await page.goto("/register");
	await page.getByLabel("First name").fill("Tunde");
	await page.getByLabel("Last name").fill("Bello");
	await page.getByRole("button", { name: "Instructor" }).click();
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByLabel("Confirm password").fill(PASSWORD);
	await page.getByRole("button", { name: "Create account" }).click();
	await expect(page).toHaveURL(/\/verify-email/);
	await verifyUserEmail(email);

	// paths.service.ts's availableCourses is scoped to `createdBy: user.id`
	// for non-admins, so the seeded course must be owned by this instructor
	// or it silently never appears in the "add a course" list.
	const instructorId = await findUserIdByEmail(email);
	const { title: courseTitle } = await seedBareCourse(instructorId);

	await page.goto("/login");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL(/\/instructor/);

	await page.goto("/instructor/paths/");
	await page.getByRole("button", { name: "New path" }).first().click();
	await page.getByPlaceholder("Path title").fill(pathTitle);
	await page.getByRole("button", { name: "Create path" }).click();
	await page.getByRole("link", { name: new RegExp(pathTitle) }).click();

	// The server-side PATH_NOT_PUBLISHABLE gate (paths.service.ts) rejects
	// publishing with zero attached courses — real validation, not just UI
	// state. Errors from this mutation surface as a plain toast of e.message.
	await page.getByRole("button", { name: "Publish path" }).click();
	await expect(
		page.getByText("Add at least one course before publishing."),
	).toBeVisible();

	// Scope to the courses select specifically — the page may have other
	// <select> elements (e.g. level), so filter by an option only this one has.
	const courseSelect = page
		.getByRole("combobox")
		.filter({ has: page.getByRole("option", { name: courseTitle }) });
	await courseSelect.selectOption({ label: courseTitle });
	await page.getByRole("button", { name: "Add course" }).click();
	await expect(page.getByText(courseTitle)).toBeVisible();

	await page.getByRole("button", { name: "Publish path" }).click();
	await expect(page.getByText("Path published")).toBeVisible();
});
