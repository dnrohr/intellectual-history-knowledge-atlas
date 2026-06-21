import { expect, test } from "@playwright/test";

test("a closed scholar dossier can be reopened without losing the selection", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const dossier = page.getByTestId("scholar-dossier");
  await expect(dossier).toBeVisible();
  await expect(dossier).toContainText("Plato");

  await page.getByTestId("dossier-close").click();
  await expect(dossier).toBeHidden();

  const reopen = page.getByTestId("dossier-reopen");
  await expect(reopen).toBeVisible();
  await expect(page.getByText("Plato", { exact: true }).first()).toBeVisible();

  await reopen.click();
  await expect(dossier).toBeVisible();
  await expect(dossier).toContainText("Plato");
});
