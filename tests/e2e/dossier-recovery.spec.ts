import { expect, test } from "@playwright/test";

test("a closed scholar dossier can be reopened without losing the selection", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const dossier = page.getByTestId("scholar-dossier");
  const canvas = page.getByTestId("network-canvas").first();
  await expect(dossier).toBeVisible();
  await expect(dossier).toContainText("Plato");
  const widthWithDossier = (await canvas.boundingBox())?.width || 0;

  await page.getByTestId("dossier-close").click();
  await expect(dossier).toBeHidden();

  const reopen = page.getByTestId("dossier-reopen");
  await expect(reopen).toBeVisible();
  await expect(page.getByText("Plato", { exact: true }).first()).toBeVisible();
  await expect.poll(async () => (await canvas.boundingBox())?.width || 0).toBeGreaterThan(widthWithDossier + 200);

  await reopen.click();
  await expect(dossier).toBeVisible();
  await expect(dossier).toContainText("Plato");
});

test("the dossier tab stays visible and clickable during close transitions", async ({ page }) => {
  test.setTimeout(60_000);

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet", width: 820, height: 844 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const dossier = page.getByTestId("scholar-dossier");
    await expect(dossier).toBeVisible();
    await page.screenshot({ path: `test-results/dossier-${viewport.name}-01-open.png` });
    await page.getByTestId("dossier-close").click();

    const reopen = page.getByTestId("dossier-reopen");
    await expect(reopen).toBeVisible();
    await expect(reopen).toContainText("Dossier");
    await page.screenshot({ path: `test-results/dossier-${viewport.name}-02-closed.png` });

    const box = await reopen.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);

    const receivesPointer = await reopen.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === button || Boolean(hit && button.contains(hit));
    });
    expect(receivesPointer).toBe(true);

    await reopen.click();
    await expect(dossier).toBeVisible();
    await expect(dossier).toBeInViewport();
    await expect(dossier).toContainText("Plato");
    const reopenedBox = await dossier.boundingBox();
    expect(reopenedBox).toBeTruthy();
    expect(reopenedBox!.x).toBeGreaterThanOrEqual(0);
    expect(reopenedBox!.x + reopenedBox!.width).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: `test-results/dossier-${viewport.name}-03-reopened.png` });

    for (const workspace of ["atlas", "timeline"] as const) {
      await page.locator(`[data-testid="workspace-${workspace}"]:visible, [data-testid="workspace-mobile-${workspace}"]:visible`).click();
      await expect(reopen).toBeVisible();
      await reopen.click();
      await expect(dossier).toBeVisible();
      await expect(dossier).toBeInViewport();
    }
  }
});
