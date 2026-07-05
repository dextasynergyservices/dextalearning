import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
	findLessonIdByTitle,
	makeLessonPublishable,
	verifyUserEmail,
} from "./support/db";

const PASSWORD = "TestPass123!";

test("instructor creates a course, adds a lesson, and publishes it", async ({
	page,
}) => {
	const email = `e2e-${randomUUID()}@example.com`;
	const courseTitle = `E2E Course ${randomUUID().slice(0, 8)}`;
	const lessonTitle = `E2E Lesson ${randomUUID().slice(0, 8)}`;

	await page.goto("/register");
	await page.getByLabel("First name").fill("Femi");
	await page.getByLabel("Last name").fill("Ade");
	await page.getByRole("button", { name: "Instructor" }).click();
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
	await page.waitForURL(/\/instructor/);

	await page.goto("/instructor/courses/");
	// "New course" renders twice: the StudioShell header action AND the empty
	// state's own CTA (no courses yet for a fresh instructor) — both do the
	// same thing, so the first is fine.
	await page.getByRole("button", { name: "New course" }).first().click();
	await page.getByPlaceholder("Course title").fill(courseTitle);
	await page.getByRole("button", { name: "Create course" }).click();

	await page.getByRole("link", { name: new RegExp(courseTitle) }).click();

	await page.getByPlaceholder("Module title").fill("Getting started");
	await page.getByRole("button", { name: "Add module" }).click();
	await expect(page.getByText("Getting started")).toBeVisible();

	await page.getByPlaceholder("Lesson title").fill(lessonTitle);
	await page.getByRole("button", { name: "Add lesson" }).click();
	await expect(page.getByText(lessonTitle)).toBeVisible();

	// Content/transcript authoring is its own already-covered flow (the lesson
	// editor form) — seed it directly so this spec stays focused on
	// create-course → add-lesson → publish, the actual golden path.
	const lessonId = await findLessonIdByTitle(lessonTitle);
	await makeLessonPublishable(lessonId);

	await page.reload();
	await expect(page.getByText(lessonTitle)).toBeVisible();
	await page.getByRole("button", { name: "Publish course" }).click();

	await expect(page.getByText("Course published 🎉")).toBeVisible();
});
