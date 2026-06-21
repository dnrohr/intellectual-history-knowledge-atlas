import { expect, test } from "@playwright/test";

test("pans the timeline by dragging the canvas surface", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId("workspace-timeline").click();

  const range = page.locator('[data-testid="timeline-window-range"]:visible').first();
  await expect(range).toBeVisible();
  const before = await range.textContent();

  const surface = page.locator('[data-testid="timeline-pan-surface"]:visible').first();
  const box = await surface.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  const startX = box.x + box.width * 0.65;
  const startY = box.y + box.height * 0.5;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 260, startY, { steps: 8 });
  await page.mouse.up();

  await expect(range).not.toHaveText(before || "");
});

test("timeline is a top-level workspace and preserves coordinated selection", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByTestId("workspace-atlas").click();
  await expect(page.getByTestId("scholar-dossier")).toContainText("Plato");
  await page.getByTestId("workspace-timeline").click();
  await expect(page.getByTestId("timeline-workspace")).toBeVisible();
  await expect(page.getByTestId("scholar-dossier")).toContainText("Plato");
  await page.getByTestId("workspace-focus").click();
  await expect(page.getByTestId("scholar-dossier")).toContainText("Plato");
});
