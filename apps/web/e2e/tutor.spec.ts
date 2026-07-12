import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { seedTutorLesson, verifyUserEmail } from "./support/db";

const PASSWORD = "TestPass123!";

/**
 * AI Lesson Tutor golden path (§4.10): a learner opens a lesson that has a
 * transcript, expands the tutor, asks a question, and watches a **streamed**
 * answer arrive. This exercises the real pipeline end-to-end — the live
 * `/tutor/stream` endpoint, RAG context, and the token-by-token UI — so it
 * makes a real Gemini call (assert a non-empty, non-error answer, not exact
 * text). Manual/local only, never CI.
 */
test("AI tutor: open lesson → ask a question → see a streamed answer", async ({
	page,
}) => {
	const { lessonId } = await seedTutorLesson();
	const email = `e2e-${randomUUID()}@example.com`;

	// Register → verify (DB bypass) → sign in.
	await page.goto("/register");
	await page.getByLabel("First name").fill("Ada");
	await page.getByLabel("Last name").fill("Bloom");
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

	// Open the lesson — the tutor only appears because it has a transcript.
	await page.goto(`/learn/lesson/${lessonId}`);
	await expect(
		page.getByRole("heading", { name: "How photosynthesis works" }),
	).toBeVisible();

	// Expand the tutor and ask.
	await page.getByRole("button", { name: /Ask the AI tutor/ }).click();
	const input = page.getByLabel("Your question");
	await expect(input).toBeVisible();
	await input.fill("What is photosynthesis?");
	await page.getByRole("button", { name: "Send" }).click();

	// The question shows immediately; the answer streams into the bubble.
	await expect(page.getByText("What is photosynthesis?")).toBeVisible();
	const answer = page.getByTestId("tutor-answer");
	await expect(answer).toHaveText(/\S/, { timeout: 45_000 }); // real Gemini
	await expect(answer).not.toContainText("couldn't answer");
	await expect(answer).not.toContainText("AI limit");
});
