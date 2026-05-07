import { expect, test } from "@playwright/test";

test.describe("Metrics dashboard", () => {
  test.beforeEach(async ({ request }) => {
    await request.post("/api/reset");
  });

  test("shows all four metric cards", async ({ page }) => {
    await page.goto("/metrics");
    await expect(page.getByRole("heading", { name: /Practice adoption/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Expert reach/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Deepest practice chain/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Expert earnings/i })).toBeVisible();
  });

  test("after running rounds, earnings card reflects rewards", async ({ page, request }) => {
    // Run several rounds to seed adoptions.
    for (let i = 0; i < 4; i += 1) await request.post("/api/round");
    await page.goto("/metrics");

    // Either at least one expert earned > 0, or 'No rewards yet' is gone.
    // We assert on the presence of a tADA value.
    await expect(page.locator("text=tADA").first()).toBeVisible();
  });
});
