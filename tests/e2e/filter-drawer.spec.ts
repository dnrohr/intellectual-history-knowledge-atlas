import { expect, test } from "@playwright/test";

test("expands taxonomy groups inside the filter drawer", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByTestId("filter-drawer-toggle").click();
  await expect(page.getByTestId("filter-drawer")).toBeVisible();

  await page.getByTestId("discipline-group-human-systems").click();
  await expect(page.getByText("Philosophy").first()).toBeVisible();

  await page.getByTestId("facet-field-expand-philosophy").click();
  await expect(page.getByTestId("facet-field-topics-philosophy")).toBeVisible();
  await expect(page.getByTestId("facet-field-topics-philosophy")).toContainText("Reality & Knowledge");
  await expect(page.getByTestId("facet-field-topics-philosophy")).toContainText("Metaphysics");
});
