import { expect, test } from "@playwright/test";
import { seedBareCourse } from "./support/db";

// Public route — no auth needed. Filtering is entirely client-side over the
// real published courses/paths/cohorts (search.tsx fetches all three and
// substring-matches in the browser, no server-side search query), so seeding
// one real course and searching for its title exercises the real thing.
test("finds a real published course by title and filters by type", async ({
	page,
}) => {
	const { title } = await seedBareCourse();

	await page.goto("/search");
	const input = page.getByPlaceholder("Search courses, paths, cohorts");
	await input.fill(title);

	await expect(page.getByText(title)).toBeVisible();

	// The "Paths" chip excludes course results — this course shouldn't survive.
	await page.getByRole("button", { name: "Paths" }).click();
	await expect(page.getByText(title)).not.toBeVisible();
	await expect(page.getByText("No results")).toBeVisible();
});
