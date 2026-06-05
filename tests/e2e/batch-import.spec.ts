import { expect, Page, test } from "@playwright/test";

const openImportActivity = async (page: Page) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId("activity-import").click();
};

const queuePastedRows = async (page: Page, rows: string[]) => {
  await page.getByTestId("batch-import-text").fill(rows.join("\n"));
  await page.getByTestId("queue-pasted-import-rows").click();
};

const getStoredAtlasState = async (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("atlas_state_v7") || "{}"));

test("queues pasted batch import rows for review", async ({ page }) => {
  await openImportActivity(page);

  await queuePastedRows(page, [
    "Test Thinker Alpha|1901|1977|Philosophy|A pasted import note",
    "Test Thinker Beta|1920||Mathematics|Another pasted import note",
  ]);

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

test("accepts a queued candidate into the atlas", async ({ page }) => {
  await openImportActivity(page);
  await queuePastedRows(page, [
    "Accepted Test Thinker|2500||Philosophy|Accepted from a pasted queue row",
  ]);

  await page.getByTestId("accept-import-review-item").click();

  await expect(page.getByTestId("import-review-queue-item")).toHaveCount(0);
  const storedAtlas = await getStoredAtlasState(page);
  const storedQueue = await page.evaluate(() => JSON.parse(localStorage.getItem("atlas_import_queue_v2") || "{}"));
  expect(storedAtlas.people.some((person: { name: string }) => person.name === "Accepted Test Thinker")).toBe(true);
  expect(storedQueue.items).toEqual([]);
});

test("edits a queued candidate before accepting it", async ({ page }) => {
  await openImportActivity(page);
  await queuePastedRows(page, [
    "Draft Test Thinker|2510||Philosophy|Original pasted note",
  ]);

  await page.getByTestId("edit-import-review-item").click();
  await expect(page.getByTestId("import-draft-name")).toHaveValue("Draft Test Thinker");

  await page.getByTestId("import-draft-name").fill("Edited Test Thinker");
  await page.getByTestId("import-draft-notes").fill("Edited note from the queue review flow");
  await page.getByTestId("accept-import-draft").click();

  const storedAtlas = await getStoredAtlasState(page);
  const storedQueue = await page.evaluate(() => JSON.parse(localStorage.getItem("atlas_import_queue_v2") || "{}"));
  const editedPerson = storedAtlas.people.find((person: { name: string }) => person.name === "Edited Test Thinker");
  expect(editedPerson?.notes).toContain("Edited note from the queue review flow");
  expect(storedQueue.items).toEqual([]);
});

test("accepts a queued candidate with its top suggested link", async ({ page }) => {
  await openImportActivity(page);
  await queuePastedRows(page, [
    "Plato Adjacent Test|-426||Philosophy|philosopher metaphysics forms academy",
  ]);

  await expect(page.getByTestId("accept-link-import-review-item")).toBeEnabled();
  await page.getByTestId("accept-link-import-review-item").click();

  const storedAtlas = await getStoredAtlasState(page);
  const imported = storedAtlas.people.find((person: { name: string }) => person.name === "Plato Adjacent Test");
  const importedEdge = storedAtlas.edges.find((edge: { source: string; target: string; status?: string; note?: string }) =>
    imported && (edge.source === imported.id || edge.target === imported.id) && edge.status === "suggested"
  );

  expect(imported).toBeTruthy();
  expect(importedEdge?.note).toContain("Imported with suggested context");
});
