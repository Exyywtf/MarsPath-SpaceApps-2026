import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("both Radiation modes render, preserve the view and expose the appropriate inspection", async ({ page }) => {
  await page.goto("/");
  const map = page.getByRole("region", { name: "Interactive Mars map" });
  await expect(map).toHaveAttribute("data-animating", "false");
  const center = await map.getAttribute("data-center");
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  const model = page.waitForResponse((r) => r.url().endsWith("radiation-atris-v1.png") && r.ok());
  const modelGrid = page.waitForResponse((r) => r.url().endsWith("radiation-atris-v1-pressure.f32") && r.ok());
  await page.getByRole('button', { name: /^Radiation Model/ }).click();
  await Promise.all([model,modelGrid]);
  await expect(page.locator(".map-legend")).toContainText("Modelled cosmic rays");
  await expect(page.locator(".map-legend")).toContainText("mSv/year");
  await map.press("Enter");
  await expect(page.locator(".inspection-card > strong")).toHaveText(/^[\d,.]+ mSv\/year$/);
  const image = page.waitForResponse((r) => r.url().endsWith("radiation-pia03480-v1.webp") && r.ok());
  await page.getByLabel("Radiation view").selectOption("radiation-historical");
  await image;
  await expect(page.locator(".map-legend")).toContainText("rem/year");
  await expect(page.locator(".layer-information")).toContainText("79.8%");
  await map.press("Enter");
  await expect(page.locator(".inspection-card > strong")).toHaveText("Outside historical image coverage");
  await page.getByLabel("Scientific layer opacity").fill("0.35");
  await expect(map).toHaveAttribute("data-center",center!);
  await page.getByRole("button", { name: "View NASA original" }).click();
  const viewer = page.getByRole("dialog", { name: "Estimated Radiation Dosage on Mars" });
  await expect(viewer.getByRole("img")).toBeVisible();
  await expect.poll(() => viewer.getByRole("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(3000);
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
  await expect(page.getByRole("button", { name: "View NASA original" })).toBeFocused();
  await page.goto("/sources/#pia03480");
  await expect(page.locator("#pia03480")).toBeVisible();
});

test("Jezero samples export with connectors and climate preferences reuse the route", async ({ page }) => {
  await page.addInitScript(() => {
    const native = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message, options) {
      if (message?.kind === "calculate")
        document.documentElement.dataset.calculations = String(Number(document.documentElement.dataset.calculations ?? 0)+1);
      return native.call(this, message, options as StructuredSerializeOptions);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await page.getByRole("button", { name: "Try Jezero terrain example" }).click();
  const analysis = page.getByRole("region", { name: "Environmental & Terrain Analysis" });
  await expect(analysis.locator(".factor-detail")).toHaveCount(4);
  const edit = page.getByRole("button", { name: "Edit route", exact: true });
  if (await edit.isVisible()) await edit.click();
  const pointA = page.locator(".point-editor").first();
  await pointA.getByText("Coordinates", { exact: true }).click();
  const longitude = page.getByLabel("A longitude");
  await longitude.fill(String(Number(await longitude.inputValue()) + .00004));
  await page.getByRole("button", { name: "Apply A" }).click();
  await expect(analysis.locator(".factor-detail")).toHaveCount(4);
  await expect(analysis.locator(".factor-detail").filter({hasText:"Modelled effective dose rate"})).toContainText("mSv/year");
  await page.getByRole("combobox", { name: "Route profile", exact: true }).selectOption("temperature");
  const scrubber = page.getByLabel("Inspect temperature along route");
  await scrubber.focus();
  await page.keyboard.press("ArrowRight");
  await expect(scrubber).toHaveAttribute("aria-valuetext", /temperature.*K/);
  const climateSettings = page.getByRole('button', { name: 'Climate preferences', exact: true });
  if (!await climateSettings.isVisible()) await edit.click();
  await climateSettings.click();
  const before = await page.locator(".route-option").allTextContents();
  const requests = await page.locator("html").getAttribute("data-calculations");
  expect(requests).toBe("2");
  await page.getByLabel("Use climate preferences").check();
  await page.getByLabel("temperature minimum").fill("190");
  await page.getByLabel("temperature maximum").fill("205");
  await page.getByRole("button", { name: "Apply climate preferences" }).click();
  await expect(page.locator(".climate-preferences")).toContainText("cannot distinguish");
  await expect(page.locator(".route-option")).toHaveText(before);
  await expect(page.locator("html")).toHaveAttribute("data-calculations",requests!);
  await expect(page.getByRole("region", { name: "Interactive Mars map" })).toHaveAttribute("data-reveal", "complete");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export route & provenance" }).click(),
  ]);
  const data = JSON.parse(await readFile((await download.path())!,"utf8"));
  const properties = data.features[0].properties;
  expect(data.schemaVersion).toBe("marspath-route-v3");
  expect(properties.analysisStatus).toBe("ready");
  expect(properties.analysis.distance).toBeCloseTo(properties.distanceM, 4);
  expect(properties.analysis.factors.radiation.scenario).toContain("700 MV");
  expect(properties.analysis.samples.some((sample: { role: string }) => sample.role === "connector")).toBe(true);
  expect(properties.ranking.weights.climate).toBe(0);
  expect(data.features.at(-1).properties.role).toBe("unassessed terrain connector");
});
