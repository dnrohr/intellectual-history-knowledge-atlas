import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 820, height: 844 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const workspaces = ["atlas", "timeline", "sources", "focus"] as const;

test("all workspaces keep one usable primary surface across target widths", async ({ page }) => {
  test.setTimeout(120_000);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    for (const workspace of workspaces) {
      await page.locator(`[data-testid="workspace-${workspace}"]:visible, [data-testid="workspace-mobile-${workspace}"]:visible`).click();

      if (workspace !== "focus") await expect(page.getByTestId("scholar-dossier")).toHaveCount(0);
      if (workspace !== "sources") await expect(page.getByTestId("source-studio-workspace")).toHaveCount(0);

      if (workspace === "atlas" || workspace === "focus") {
        await expect(page.locator('[data-testid="network-canvas"]:visible').first()).toBeVisible();
      } else if (workspace === "timeline") {
        await expect(page.getByTestId("timeline-workspace")).toBeVisible();
      } else {
        await expect(page.getByTestId("source-studio-workspace")).toBeVisible();
      }

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(2);
      await page.waitForTimeout(350);
      await page.screenshot({ path: `test-results/${viewport.name}-${workspace}.png` });
    }
  }
});

test("tablet and mobile dossiers behave as dismissible bottom sheets", async ({ page }) => {
  for (const viewport of viewports.slice(1)) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByTestId("scholar-dossier")).toBeVisible();
    const box = await page.getByTestId("scholar-dossier").boundingBox();
    expect(box?.width || 0).toBeGreaterThan(viewport.width * 0.95);
    expect(box?.y || 0).toBeGreaterThan(viewport.height * 0.3);
    await page.getByTestId("dossier-close").click();
    await expect(page.getByTestId("dossier-reopen")).toBeVisible();
    await page.getByTestId("dossier-reopen").click();
    await expect(page.getByTestId("scholar-dossier")).toBeVisible();
  }
});
