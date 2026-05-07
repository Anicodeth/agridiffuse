import { expect, test } from "@playwright/test";

test.describe("Spread simulator — full demo journey", () => {
  test.beforeEach(async ({ request }) => {
    // Reset the in-memory graph before each test so rounds start at 0.
    await request.post("/api/reset");
  });

  test("running a round produces a narrative and updates the round counter", async ({ page }) => {
    await page.goto("/simulate");
    const nextRound = page.getByRole("button", { name: /Next round/i });
    await expect(nextRound).toBeVisible();

    await nextRound.click();

    // Round counter ticks to 1 in the narrator stat strip
    await expect(page.locator("text=Round").first()).toBeVisible();
    await expect(page.getByText("1", { exact: true }).first()).toBeVisible();

    // Narrative box renders something non-empty
    const narrator = page.locator("text=via Featherless").locator("..");
    await expect(narrator).toBeVisible();
  });

  test("running multiple rounds advances the counter", async ({ page }) => {
    await page.goto("/simulate");
    const nextRound = page.getByRole("button", { name: /Next round/i });

    for (let i = 1; i <= 3; i += 1) {
      await nextRound.click();
      // Avoid racing the next click on the still-running button
      await expect(nextRound).toBeEnabled();
    }

    // The narrator round stat should be 3 after 3 clicks
    await expect(page.getByText("3", { exact: true }).first()).toBeVisible();
  });

  test("Reset clears the round counter back to idle", async ({ page }) => {
    await page.goto("/simulate");
    await page.getByRole("button", { name: /Next round/i }).click();
    await expect(page.getByText("via Featherless")).toBeVisible();

    await page.getByRole("button", { name: /Reset graph/i }).click();
    // After reset, the narrator should show the empty/idle state again
    await expect(page.getByText("Idle")).toBeVisible();
  });

  test("spacebar shortcut also advances a round", async ({ page }) => {
    await page.goto("/simulate");
    await page.locator("body").click(); // give the body focus
    await page.keyboard.press("Space");
    await expect(page.getByText("via Featherless")).toBeVisible({ timeout: 10_000 });
  });
});
