import { expect, test } from "@playwright/test";

test("Jezero mission shares the draft, plans its return and compares a fixed candidate pool", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message, ...args) {
      if (message?.kind === "calculate") document.documentElement.dataset.searches =
        String(1 + Number(document.documentElement.dataset.searches || 0));
      return Reflect.apply(post, this, [message, ...args]);
    };
  });
  await page.goto("/?mission=jezero");
  await expect(page.getByRole("heading", { name: "Mission Planner" })).toBeVisible();
  await expect(page.getByLabel("Speed (km/h)", { exact: true })).toHaveValue("");
  await expect(page.getByText("Choose a start", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try validated mission example" }).click();
  await expect(page.getByRole("heading", { name: "Compare routes" })).toBeVisible();
  const journey = page.getByRole("region", { name: "Mission journey" });
  await expect(journey).toContainText("Outbound · A to B");
  await expect(journey).toContainText("Return · B to A");
  await expect(journey).toContainText("Estimated round-trip duration");
  await page.getByRole("button", { name: "What changes this recommendation?" }).click();
  await page.getByRole("button", { name: "Science first", exact: true }).click();
  await expect(page.locator(".route-option.selected")).toContainText("Science-aware route");
  await page.getByRole("button", { name: "Shortest", exact: true }).click();
  await expect(page.locator(".route-option.selected")).toContainText("Shortest feasible");
  await expect(page.locator("html")).toHaveAttribute("data-searches", "1");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Compare routes" })).toBeVisible();
  await page.getByRole("button", { name: "Mission Planner", exact: true }).click();
  await expect(page.getByLabel("Speed (km/h)", { exact: true })).toHaveValue("2");
  await expect(journey).toContainText("Return · B to A");
  await expect(page.locator("html")).toHaveAttribute("data-searches", "1");
});

test("terrain coverage inspection and shared Help work from the static pages", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?place=jezero");
  const map = page.locator('#interactive-mars-map[data-ready="true"][data-animating="false"]');
  await expect(map).toBeVisible();
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.getByLabel(/Scientific destinations/).uncheck();
  await page.getByRole("button", { name: /^Data Quality & Coverage/ }).click();
  await expect(map).toHaveAttribute("data-overlay", "coverage");
  await expect(page.getByRole("list", { name: "Terrain coverage legend" }).last()).toContainText("Coarse MOLA terrain");
  const box = (await map.boundingBox())!;
  const [lon, lat] = JSON.parse((await map.getAttribute("data-center"))!);
  const scale = Number(await map.getAttribute("data-resolution"));
  await map.click({ position: { x: box.width / 2 + (77.5 - lon) / scale, y: box.height / 2 - (18.4 - lat) / scale } });
  await expect(page.getByRole("complementary", { name: "Scientific value inspection" })).toContainText("Regional terrain");
  await page.goto("/sources/");
  await page.setViewportSize({ width: 320, height: 568 });
  const help = page.getByRole("link", { name: "Help and keyboard shortcuts" });
  expect((await help.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await help.click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
