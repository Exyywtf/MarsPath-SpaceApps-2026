import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import oxia from "../../public/processed/oxia.json";

test("Oxia detailed planning uses its validated footprint and preserves the Gazetteer position", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let downloads = 0;
  page.on("request", (request) => { if (request.url().endsWith("oxia-elevation.f32")) downloads++; });
  await page.goto("/?place=oxia");
  await expect(page.locator(".coordinates")).toContainText("17.280°N");
  await expect(page.locator(".coordinates")).toContainText("25.710°W");
  await page.getByRole("button", { name: "Plan detailed Oxia route" }).click();
  await expect(page.getByText("Choose A and B to begin.", { exact: true })).toBeVisible();
  const map = page.locator("#interactive-mars-map");
  await expect(map).toHaveAttribute("data-ready", "true");
  await expect.poll(async () => Number(await map.getAttribute("data-resolution"))).toBeLessThan(0.002);
  expect(downloads).toBe(0);
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.getByRole("button", { name: /^Oxia Planum/ }).click();
  await page.getByRole("button", { name: "Try Oxia terrain example" }).click();
  await expect(page.getByRole("heading", { name: "Compare routes" })).toBeVisible();
  await expect(page.locator(".route-option")).toHaveCount(2);
  await expect.poll(async () => Number(await map.getAttribute("data-resolution"))).toBeLessThan(0.002);
  const file = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export route & provenance" }).click();
  const exported = JSON.parse(await readFile(await (await file).path(), "utf8"));
  const properties = exported.features[0].properties;
  expect(properties.terrainDataset).toBe(oxia.id);
  expect(properties.terrainSha256).toBe(oxia.sha256);
  expect(properties.distanceM).toBeGreaterThan(2500);
  expect(properties.distanceM).toBeLessThan(2600);
  expect(properties.tier).toBe("regional");
  expect(properties.reachedTargets).toEqual([]);
  await page.getByRole("button", { name: "Recalculate", exact: true }).click();
  await expect(page.locator(".route-option")).toHaveCount(2);
  expect(downloads).toBe(1);
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.getByRole("button", { name: /^Data Quality & Coverage/ }).click();
  await expect(page.locator("#interactive-mars-map")).toHaveAttribute("data-overlay", "coverage");
});

test("MEDA loads on demand and inspecting archived sensors preserves the mission and candidate pool", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let medaRequests = 0;
  await page.addInitScript(() => {
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message, ...args) {
      if (message?.kind === "calculate") document.documentElement.dataset.searches =
        String(1 + Number(document.documentElement.dataset.searches || 0));
      return Reflect.apply(post, this, [message, ...args]);
    };
  });
  page.on("request", (request) => { if (request.url().endsWith("meda-sols-30-32-v1.json")) medaRequests++; });
  await page.goto("/?mission=jezero");
  await page.getByRole("button", { name: "Try validated mission example" }).click();
  await expect(page.getByText("Return · B to A", { exact: true })).toBeVisible();
  expect(medaRequests).toBe(0);
  const map = page.locator("#interactive-mars-map");
  const centre = await map.getAttribute("data-center");
  const endpoints = await page.locator(".point-label strong").allTextContents();
  await page.getByRole("button", { name: "Historical observations · MEDA", exact: true }).click();
  const observations = page.locator(".historical-observations");
  await expect(observations).toContainText("2021-03-21T00:11:53.795Z");
  await expect(observations).toContainText("742.11 Pa");
  await expect(observations.locator(".observation-axis")).toHaveCSS("font-size", "12px");
  await page.getByLabel("Observation sol").selectOption("32");
  await page.getByLabel("Observed variable").selectOption("1");
  await expect(observations).toContainText("1.45 m above the surface");
  await expect(observations).toContainText("zero ranking weight");
  await expect(observations).toContainText("2021-03-23T01:31:04.195Z");
  await page.getByRole("button", { name: "Observation sources & limitations" }).click();
  await expect(observations.getByRole("link", { name: "Original temperature product" })).toHaveAttribute("href", /WE__0032.*CAL_ATS.*P01.CSV$/);
  await page.getByLabel("Inspect archived sample").focus();
  await page.keyboard.press("ArrowRight");
  await expect(map).toHaveAttribute("data-center", centre!);
  await expect(page.locator(".point-label strong")).toHaveText(endpoints);
  await expect(page.locator("html")).toHaveAttribute("data-searches", "1");
  expect(medaRequests).toBe(1);
});
