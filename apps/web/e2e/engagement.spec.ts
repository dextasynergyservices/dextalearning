import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { seedEngagementCourse, verifyUserEmail } from "./support/db";

const PASSWORD = "TestPass123!";

/**
 * Phase 4 golden path (§3.1/§3.2): enrol → the course card gains social
 * proof → read the lesson → pass the post-quiz (growth-framed result) →
 * lesson + course complete → the dashboard celebrates the new badges, the
 * header flame lights to 1, the streak panel confirms today, and the bell
 * holds the badge notifications.
 */
test("engagement loop: complete a lesson → streak, badges, growth line, social proof, bell", async ({
	page,
}) => {
	const { courseSlug, courseTitle, lessonId } = await seedEngagementCourse();
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

	await page.goto("/login");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL(/\/dashboard/);

	// Enrol (emits EnrollmentCreated → Catalog's denormalized counter).
	await page.goto(`/courses/${courseSlug}`);
	await page.getByRole("button", { name: "Enrol now" }).click();
	await expect(
		page.getByRole("link", { name: "Start learning" }),
	).toBeVisible();

	// Social proof: this course's catalog card now says "1 enrolled" (§3.2).
	await page.goto("/teachers/courses/");
	const card = page.getByRole("link", { name: new RegExp(courseTitle) });
	await expect(card.getByText("1 enrolled")).toBeVisible();

	// Read the (short) text lesson — consumption completes on render, which
	// unlocks the post-lesson quiz.
	await page.goto(`/learn/lesson/${lessonId}`);
	await expect(
		page.getByRole("heading", { name: "Habits that stick" }),
	).toBeVisible();
	await page.getByRole("button", { name: "Start quiz" }).click();

	await expect(page.getByText("What builds a learning habit?")).toBeVisible();
	await page.getByRole("button", { name: "Showing up daily" }).click();
	await page.getByRole("button", { name: "Submit" }).click();

	// Growth-framed result (§3.1) — the baseline line leads, never a bare grade.
	await expect(
		page.getByText(
			"You scored 100% — that's your baseline. Everything from here is growth.",
		),
	).toBeVisible();
	// Passing the only gate completes the lesson (and the 1-lesson course).
	await expect(page.getByText("Completed — well done!")).toBeVisible();

	// Dashboard: the unseen badges celebrate one at a time — dismiss the queue
	// (first_lesson, first_quiz_pass, perfect_quiz, first_course order varies).
	await page.goto("/dashboard");
	const celebration = page.getByRole("dialog", { name: "Award unlocked!" });
	await expect(celebration).toBeVisible();
	for (let i = 0; i < 8 && (await celebration.isVisible()); i++) {
		// Each dismissal swaps the medallion via AnimatePresence — the button
		// detaches mid-transition, so let the spring settle and tolerate a
		// click landing on the exiting copy (the loop just re-checks).
		await page.waitForTimeout(600);
		await celebration
			.getByRole("button", { name: /Keep going|Next award/ })
			.click({ timeout: 3000 })
			.catch(() => {});
	}
	await expect(celebration).not.toBeVisible();

	// Header flame lit to 1 (§3.2 streak) + live stats tile + streak panel.
	await expect(
		page.getByRole("banner").getByLabel("1-day streak"),
	).toBeVisible();
	await expect(page.getByTestId("stat-streak")).toContainText("1");
	await expect(page.getByTestId("streak-panel")).toContainText(
		"Today is in the bag.",
	);

	// The bell holds the badge_awarded notifications (§8.6 in-app channel).
	await page.getByRole("button", { name: "Notifications" }).click();
	await expect(page.getByText("You earned a new award").first()).toBeVisible();
});
