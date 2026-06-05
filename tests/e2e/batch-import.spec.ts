import { expect, test } from "@playwright/test";

test("queues pasted batch import rows for review", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByTestId("activity-import").click();
  await page.getByTestId("batch-import-text").fill([
    "Test Thinker Alpha|1901|1977|Philosophy|A pasted import note",
    "Test Thinker Beta|1920||Mathematics|Another pasted import note",
  ].join("\n"));
  await page.getByTestId("queue-pasted-import-rows").click();

  await expect(page.getByTestId("import-review-queue-item")).toHaveCount(2);
  await expect(page.getByTestId("import-review-queue")).toContainText("Test Thinker Alpha");
  await expect(page.getByTestId("import-review-queue")).toContainText("Test Thinker Beta");

  const storedQueue = await page.evaluate(() => JSON.parse(localStorage.getItem("atlas_import_queue_v2") || "{}"));
  expect(storedQueue.items).toHaveLength(2);
  expect(storedQueue.items.map((item: { candidate: { name: string } }) => item.candidate.name)).toEqual([
    "Test Thinker Alpha",
    "Test Thinker Beta",
  ]);
});
