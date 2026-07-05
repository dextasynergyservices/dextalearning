import { randomUUID } from "node:crypto";
import { type Browser, expect, test } from "@playwright/test";
import {
	promoteToAdmin,
	seedOtherLearnerSubmission,
	seedProjectForGrading,
	seedProjectForPeerReview,
	verifyUserEmail,
} from "./support/db";

const PASSWORD = "TestPass123!";

async function registerAndLogin(
	browser: Browser,
	role: "learner" | "instructor" | "admin",
	name: { first: string; last: string },
): Promise<import("@playwright/test").Page> {
	const context = await browser.newContext();
	const page = await context.newPage();
	const email = `e2e-${randomUUID()}@example.com`;

	await page.goto("/register");
	await page.getByLabel("First name").fill(name.first);
	await page.getByLabel("Last name").fill(name.last);
	if (role === "instructor") {
		await page.getByRole("button", { name: "Instructor" }).click();
	}
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByLabel("Confirm password").fill(PASSWORD);
	await page.getByRole("button", { name: "Create account" }).click();
	await expect(page).toHaveURL(/\/verify-email/);
	await verifyUserEmail(email);
	if (role === "admin") await promoteToAdmin(email);

	await page.goto("/login");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL(
		role === "instructor"
			? /\/instructor/
			: role === "admin"
				? /\/admin/
				: /\/dashboard/,
	);

	return page;
}

test("learner submits a project and an admin grades it manually", async ({
	browser,
}) => {
	// Seeded projects have no owning instructor (createdBy is null), so a
	// plain instructor would fail projects.service.ts's assertCanManage
	// ownership check — admin bypasses per-resource ownership entirely
	// (`user.role === "admin"`), matching the pattern admin.spec.ts already
	// uses for the same reason.
	const { projectId } = await seedProjectForGrading();

	const learnerPage = await registerAndLogin(browser, "learner", {
		first: "Ronke",
		last: "Bassey",
	});
	await learnerPage.goto(`/learn/project/${projectId}`);
	await learnerPage
		.getByLabel("Write-up")
		.fill("Here is my write-up for the capstone project.");
	await learnerPage.getByRole("button", { name: "Submit project" }).click();
	await expect(learnerPage.getByText("Submission sent")).toBeVisible();

	const adminPage = await registerAndLogin(browser, "admin", {
		first: "Kwame",
		last: "Osei",
	});
	await adminPage.goto(`/admin/project-submissions/${projectId}`);
	await adminPage.getByRole("button", { name: /Ronke Bassey/ }).click();
	await adminPage.getByLabel("Score %").fill("85");
	await adminPage.getByLabel("Feedback").fill("Solid work overall.");
	await adminPage.getByRole("button", { name: "Save grade" }).click();

	await expect(adminPage.getByText("Grade saved")).toBeVisible();
	await expect(adminPage.getByText("Graded · 85%")).toBeVisible();
});

test("learner completes a peer review", async ({ browser }) => {
	const { projectId } = await seedProjectForPeerReview();
	await seedOtherLearnerSubmission(projectId);

	const page = await registerAndLogin(browser, "learner", {
		first: "Femi",
		last: "Alabi",
	});

	// Loading this page is what triggers the real lazy-assignment logic
	// (submissions.service.ts listMyReviews) — no separate "assign" step.
	await page.goto(`/learn/peer-review/${projectId}`);
	await expect(page.getByText("Quality")).toBeVisible();

	await page.getByRole("spinbutton").fill("8");
	await page
		.getByPlaceholder("Feedback for your peer…")
		.fill("Nice structure, clear argument.");
	await page.getByRole("button", { name: "Submit review" }).click();

	await expect(page.getByText("Review submitted")).toBeVisible();
	// exact: true — "Reviewed" is a case-insensitive substring of the page's
	// own "Peer-reviewed essay" heading otherwise.
	await expect(page.getByText("Reviewed", { exact: true })).toBeVisible();
});
