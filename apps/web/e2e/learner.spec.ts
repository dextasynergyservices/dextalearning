import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { seedLearnerCourse, verifyUserEmail } from "./support/db";

const PASSWORD = "TestPass123!";

test("browse → enroll → view lesson → pass the assessment", async ({
	page,
}) => {
	// The longest golden path here — register, verify, login, browse, enrol,
	// read, then sit the final — on Playwright's default 30s budget. It runs in
	// ~10s alone but exceeded 30s from inside the serial suite, where every spec
	// shares one dev server and one DB. Nothing is wrong with the app; the
	// budget was simply sized for the isolated case.
	test.slow();
	const { courseSlug, lessonId, assessmentId } = await seedLearnerCourse();
	const email = `e2e-${randomUUID()}@example.com`;

	await page.goto("/register");
	await page.getByLabel("First name").fill("Chinwe");
	await page.getByLabel("Last name").fill("Okafor");
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

	// Catalog → course detail — the real browse path, not a direct deep link.
	await page.goto("/teachers/courses/");
	await page.getByRole("link", { name: /Spaced Repetition Basics/ }).click();
	await expect(page).toHaveURL(new RegExp(`/courses/${courseSlug}`));

	await page.getByRole("button", { name: "Enrol now" }).click();
	await expect(
		page.getByRole("link", { name: "Start learning" }),
	).toBeVisible();

	// The lesson/assessment routes are legitimately deep-linkable (learners
	// bookmark/resume mid-course), so jumping straight there — rather than
	// clicking through the learn hub's outline — still exercises the real
	// enrolment-gated page + API, not just a UI click chain.
	await page.goto(`/learn/lesson/${lessonId}`);
	// The lesson title also appears as a nav button in the sidebar lesson-list
	// panel — scope to the page's own <h1>.
	await expect(
		page.getByRole("heading", { name: "What is spacing?" }),
	).toBeVisible();
	await expect(page.getByText("Spacing beats cramming.")).toBeVisible();

	// Wait for the completion to actually persist. The seeded lesson is short
	// enough to auto-complete on load, but navigating away before the write
	// lands leaves the course incomplete — which the §4.3.1 finals gate then
	// (correctly) uses to lock the assessment below. Without this the test
	// races and fails intermittently.
	await expect(page.getByText("Completed", { exact: true })).toBeVisible();

	await page.goto(`/learn/assessment/${assessmentId}`);
	// Scope to the heading: the fixture is titled "Module quiz" but is really a
	// `course_final`, so the gate's "…module quizzes first." note would also
	// substring-match a bare getByText.
	await expect(
		page.getByRole("heading", { name: "Module quiz" }),
	).toBeVisible();
	await page.getByRole("button", { name: "Start assessment" }).click();

	await expect(
		page.getByText("Which technique spreads study sessions over time?"),
	).toBeVisible();
	await page.getByRole("button", { name: "Spaced repetition" }).click();
	await page.getByRole("button", { name: "Submit" }).click();

	await expect(page.getByText("Passed")).toBeVisible();
});
