import { expect, test } from "@playwright/test";

const sourceStudioTabs = [
  "sourceHealth",
  "claimConflicts",
  "candidateRelationships",
  "repairJobs",
  "manualOverrides",
  "exportRecovery",
] as const;

test("source studio modes stay reachable without viewport overflow", async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 820, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.getByTestId("workspace-sources").click();

    for (const tab of sourceStudioTabs) {
      const button = page.getByTestId(`source-studio-tab-${tab}`);
      await expect(button).toBeVisible();
      await button.click();
      await expect(button).toHaveClass(/text-emerald-200/);
    }

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(2);
  }
});
