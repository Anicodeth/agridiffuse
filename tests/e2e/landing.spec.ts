import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders the hero headline and primary CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Knowledge spreads/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Open the graph/i }).first()).toBeVisible();
  });

  test("primary CTA navigates to the graph canvas", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Open the graph/i }).first().click();
    await expect(page).toHaveURL(/\/graph/);
    await expect(page.getByRole("heading", { name: /The graph/ })).toBeVisible();
  });

  test("nav links lead to the three core screens", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Graph" }).click();
    await expect(page).toHaveURL(/\/graph/);

    await page.getByRole("link", { name: "Simulate" }).click();
    await expect(page).toHaveURL(/\/simulate/);

    await page.getByRole("link", { name: "Metrics" }).click();
    await expect(page).toHaveURL(/\/metrics/);
  });
});
