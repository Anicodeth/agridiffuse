import { expect, test } from "@playwright/test";

test.describe("Graph canvas", () => {
  test.beforeEach(async ({ request }) => {
    await request.post("/api/reset");
  });

  test("renders the canvas and the legend", async ({ page }) => {
    await page.goto("/graph");
    await expect(page.getByRole("heading", { name: /The graph/ })).toBeVisible();

    // Wait for React Flow to mount by checking for at least one node label.
    await expect(page.getByText("Drip irrigation").first()).toBeVisible();
    // Legend entries
    await expect(page.getByText("Expert", { exact: true })).toBeVisible();
    await expect(page.getByText("Adopted farmer", { exact: true })).toBeVisible();
  });

  test("clicking a node opens the side panel", async ({ page }) => {
    await page.goto("/graph");
    // Wait for nodes to render
    await page.getByText("Dr. Meera Otieno").first().waitFor({ state: "visible" });
    await page.getByText("Dr. Meera Otieno").first().click();
    // Side panel shows the same name as a heading
    await expect(page.getByRole("heading", { name: /Dr\. Meera Otieno/ })).toBeVisible();
    // And a close button
    await expect(page.getByRole("button", { name: "Close panel" })).toBeVisible();
  });
});
