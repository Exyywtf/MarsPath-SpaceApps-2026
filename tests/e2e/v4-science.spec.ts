import { expect, test, type Locator } from "@playwright/test";

async function tapCoordinate(map: Locator, longitude: number, latitude: number) {
  const box = (await map.boundingBox())!;
  const [lon, lat] = JSON.parse((await map.getAttribute("data-center"))!);
  const resolution = Number(await map.getAttribute("data-resolution"));
  const wrapped = longitude + 360 * Math.round((lon - longitude) / 360);
  await map.click({ position: { x: box.width / 2 + (wrapped - lon) / resolution, y: box.height / 2 - (latitude - lat) / resolution } });
}

test("registered geology, mineral markers and thermal cells retain the map view", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (/\/science-v[12]\//.test(request.url())) requests.push(request.url()); });
  await page.goto("/?place=sirenum");
  const map = page.locator('#interactive-mars-map[data-ready="true"]');
  await expect(map).toHaveAttribute("data-animating", "false");
  expect(requests).toHaveLength(0);
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.getByLabel(/Scientific destinations/).uncheck();
  const centre = await map.getAttribute("data-center");
  const resolution = await map.getAttribute("data-resolution");
  const polygon = page.getByRole("button", { name: /^Global geology/ });
  await polygon.click();
  await expect(map).toHaveAttribute("data-overlay", "geology");
  const initialOpacity = await page.locator(".layer-details").evaluate((node) => {
    const animation = node.getAnimations()[0];
    if (!animation) return getComputedStyle(node).opacity;
    const time = animation.currentTime;
    animation.currentTime = 0;
    const opacity = getComputedStyle(node).opacity;
    animation.currentTime = time;
    return opacity;
  });
  expect(initialOpacity).toBe("1");
  await page.getByRole("button", { name: "Geologic unit legend" }).click();
  await expect(page.getByRole("list", { name: "Global geology legend" }).getByRole("listitem")).toHaveCount(44);
  await expect(page.locator(".layer-information")).toContainText("1:20,000,000");
  await tapCoordinate(map, -137.625, -39.125);
  await expect(page.locator(".inspection-card")).toContainText(/USGS polygon \d+/);
  await expect(page.locator(".inspection-card>strong")).toContainText("unit");
  await page.getByRole("button", { name: "Close value inspection" }).click();

  await page.getByRole("button", { name: /^Mineral observations/ }).click();
  await expect(map).toHaveAttribute("data-overlay", "minerals");
  await expect(page.locator(".map-legend")).toContainText("CRISM observation centre");
  await tapCoordinate(map, -138.707, -38.781);
  await expect(page.locator(".inspection-card")).toContainText("TS_38.78S_221.29");
  await expect(page.locator(".inspection-card").getByRole("link", { name: "Catalogue source" }).first()).toHaveAttribute("href", /^https:\/\/data\.caltech\.edu/);
  await page.getByRole("button", { name: "Close value inspection" }).click();

  await page.getByRole("button", { name: /^Thermal inertia/ }).click();
  await expect(map).toHaveAttribute("data-overlay", "thermal-inertia");
  await expect(page.locator(".map-legend")).toContainText("≥1,800");
  await tapCoordinate(map, -137.625, -39.125);
  await expect(page.locator(".inspection-card>strong")).toHaveText("195 J m⁻² K⁻¹ s⁻½");
  await tapCoordinate(map, -138.625, -39.125);
  await expect(page.locator(".inspection-card>strong")).toHaveText("No numerical value");
  await expect(map).toHaveAttribute("data-center", centre!);
  await expect(map).toHaveAttribute("data-resolution", resolution!);
});

test("the PDS hydrated mineral layer shows published coordinates and product IDs", async ({ page }) => {
  await page.goto("/?place=mawrth");
  const map = page.locator('#interactive-mars-map[data-ready="true"]');
  await expect(map).toHaveAttribute("data-animating", "false");
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.getByLabel(/Scientific destinations/).uncheck();
  const centre = await map.getAttribute("data-center");
  const resolution = await map.getAttribute("data-resolution");
  await page.getByRole("button", { name: /^Mineral observations/ }).click();
  await expect(map).toHaveAttribute("data-overlay", "minerals");
  await expect(page.locator(".map-legend")).toContainText("Hydrated mineral site");
  await expect(page.locator(".layer-information")).toContainText("1,851 NASA PDS hydrated mineral records");
  await tapCoordinate(map, -17.04, 22.47);
  const record = page.locator(".inspection-records li").filter({ hasText: "FRT0001654F" });
  await expect(record).toContainText("22.47°N 17.04°W");
  await expect(record).toContainText("PDS row 650 · species unspecified");
  await expect(record.getByRole("link", { name: "Catalogue source" })).toHaveAttribute("href", /pds-geosciences\.wustl\.edu.*\/hydrous\//);
  await expect(page.getByRole("link", { name: "Catalogue methods" })).toHaveAttribute("href", "/methodology/#exploration-science");
  await expect(map).toHaveAttribute("data-center", centre!);
  await expect(map).toHaveAttribute("data-resolution", resolution!);
});

test("a failed science grid leaves the last working map and allows retry", async ({ page }) => {
  await page.route("**/science-v1/thermal-inertia.bin.gz", (route) => route.abort(), { times: 1 });
  await page.goto("/");
  const map = page.locator('#interactive-mars-map[data-ready="true"]');
  await expect(map).toBeVisible();
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.getByRole("button", { name: /^Global geology/ }).click();
  await expect(map).toHaveAttribute("data-overlay", "geology");
  await page.getByRole("button", { name: /^Thermal inertia/ }).click();
  await expect(page.locator(".layer-information")).toContainText("Showing Global geology");
  await expect(map).toHaveAttribute("data-overlay", "geology");
  await page.getByRole("button", { name: "Retry overlay" }).click();
  await expect(map).toHaveAttribute("data-overlay", "thermal-inertia");
});
