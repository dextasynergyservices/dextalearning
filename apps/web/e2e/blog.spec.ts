import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
	findBlogPostIdByTitle,
	promoteToAdmin,
	setBlogPostBody,
	verifyUserEmail,
} from "./support/db";

const PASSWORD = "TestPass123!";

test("admin creates, publishes, and deletes a blog post", async ({ page }) => {
	const email = `e2e-${randomUUID()}@example.com`;
	const postTitle = `E2E Post ${randomUUID().slice(0, 8)}`;

	await page.goto("/register");
	await page.getByLabel("First name").fill("Zainab");
	await page.getByLabel("Last name").fill("Musa");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByLabel("Confirm password").fill(PASSWORD);
	await page.getByRole("button", { name: "Create account" }).click();
	await expect(page).toHaveURL(/\/verify-email/);
	await verifyUserEmail(email);
	await promoteToAdmin(email);

	await page.goto("/login");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL(/\/admin/);

	await page.goto("/admin/blog/");
	await page.getByRole("button", { name: "New post" }).first().click();
	await page.getByPlaceholder("Title").fill(postTitle);
	await page.getByRole("button", { name: "Create post" }).click();
	await page.getByRole("link", { name: new RegExp(postTitle) }).click();

	// Publish requires non-empty body_html — seeded directly rather than
	// driving the Tiptap editor, same reasoning as the other content shortcuts.
	const postId = await findBlogPostIdByTitle(postTitle);
	await setBlogPostBody(
		postId,
		"<p>Seeded body for the Phase F golden path.</p>",
	);
	await page.reload();

	await page.getByRole("button", { name: "Publish post" }).click();
	await expect(page.getByText("Post published")).toBeVisible();

	await page.goto("/admin/blog/");
	// title → its wrapping generic span → the Link → the article, which also
	// holds the Delete button as a sibling of the Link.
	const row = page
		.getByText(postTitle, { exact: true })
		.locator("..")
		.locator("..")
		.locator("..");
	await row.getByRole("button", { name: "Delete" }).click();
	await expect(page.getByText("Delete post?")).toBeVisible();
	await page.getByRole("button", { name: "Delete course" }).click();

	await expect(page.getByText("Post deleted")).toBeVisible();
	await expect(page.getByText(postTitle, { exact: true })).not.toBeVisible();
});
