import { expect, test } from "@playwright/test";

const visibleNetworkCount = async (page: import("@playwright/test").Page) => {
  const label = page.getByText(/Influence Network \(\d+\)/).first();
  await expect(label).toBeVisible();
  const text = await label.textContent();
  return Number(text?.match(/\((\d+)\)/)?.[1] || 0);
};

test("network controls update hop depth, layout, and labels without full-width overlays", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.locator('[data-testid="network-canvas"]:visible').first()).toBeVisible();

  const toolbarBox = await page.locator('[data-testid="network-layout-toolbar"]:visible').first().boundingBox();
  const viewport = page.viewportSize();
  expect(toolbarBox).toBeTruthy();
  expect(viewport).toBeTruthy();
  if (toolbarBox && viewport) {
    expect(toolbarBox.width).toBeLessThan(viewport.width * 0.72);
  }

  await page.locator('[data-testid="network-hop-1"]:visible').first().click();
  const oneHopCount = await visibleNetworkCount(page);

  await page.locator('[data-testid="network-hop-3"]:visible').first().click();
  await expect.poll(() => visibleNetworkCount(page)).toBeGreaterThanOrEqual(oneHopCount);

  await page.locator('[data-testid="network-hop-all"]:visible').first().click();
  await expect.poll(() => visibleNetworkCount(page)).toBeGreaterThanOrEqual(oneHopCount);
  await expect(page.getByText("Dense Overview")).toBeVisible();

  for (const layout of ["force", "timeline", "ego", "lineage"]) {
    const button = page.locator(`[data-testid="network-layout-${layout}"]:visible`).first();
    await button.click();
    await expect(button).toHaveClass(/text-\[#9bdaff\]/);
  }

  for (const density of ["focus", "key", "more", "all"]) {
    const button = page.locator(`[data-testid="network-label-${density}"]:visible`).first();
    await button.click();
    await expect(button).toHaveClass(/text-cyan-200/);
  }
});
