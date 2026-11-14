import { expect, test } from "@playwright/test";

const sizes = [
  [1920, 1080], [1440, 900], [1366, 768], [1024, 768],
  [834, 1194], [1194, 834], [390, 844], [375, 667], [844, 390],
];

test("fresh startup fits the whole globe through all nine layouts", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("marspath-draft-v2", JSON.stringify({
      start: [77.4, 18.4], end: [77.43, 18.45], waypoints: [[77.5, 18.45]],
    }));
  });
  let terrainRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("-elevation.f32")) terrainRequests++;
  });
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const map = page.getByRole("region", { name: "Interactive Mars map" });
    await expect(map).toHaveAttribute("data-ready", "true");
    const fit = await map.evaluate((canvas) => {
      const [lon, lat] = JSON.parse(canvas.dataset.center!);
      const resolution = Number(canvas.dataset.resolution);
      const panel = document.querySelector<HTMLElement>("#workflow-panel")!;
      const sidebar = getComputedStyle(panel).getPropertyValue("--side-panel").trim() === "1";
      const edges = {
        west: canvas.clientWidth / 2 + (-180 - lon) / resolution,
        east: canvas.clientWidth / 2 + (180 - lon) / resolution,
        north: canvas.clientHeight / 2 - (90 - lat) / resolution,
        south: canvas.clientHeight / 2 - (-90 - lat) / resolution,
      };
      return {
        frame: {
          left: sidebar ? panel.offsetLeft + panel.offsetWidth : 0,
          top: document.querySelector(".topbar")!.getBoundingClientRect().bottom,
          bottom: sidebar ? document.querySelector(".map-footer")!.getBoundingClientRect().top : panel.offsetTop,
          right: document.querySelector(".map-controls")!.getBoundingClientRect().left,
        },
        edges,
        fitsPage: document.documentElement.scrollWidth <= innerWidth,
        background: getComputedStyle(document.querySelector(".map-area")!).backgroundColor,
      };
    });
    expect(fit.edges.west, `${width} × ${height} west`).toBeGreaterThan(fit.frame.left);
    expect(fit.edges.east, `${width} × ${height} east`).toBeLessThan(fit.frame.right);
    expect(fit.edges.north, `${width} × ${height} north`).toBeGreaterThan(fit.frame.top);
    expect(fit.edges.south, `${width} × ${height} south`).toBeLessThan(fit.frame.bottom);
    expect(fit.fitsPage).toBe(true);
    expect(fit.background).toBe("rgb(9, 14, 18)");
  }
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await expect(page.locator(".point-label strong")).toHaveText(["Choose a start", "Choose a destination"]);
  await expect(page.locator(".waypoint-row")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try Jezero terrain example" })).toBeEnabled();
  expect(terrainRequests).toBe(0);
});

test("a verified destination link sets the startup view with an empty draft", async ({ page }) => {
  await page.goto("/?place=jezero");
  const map = page.getByRole("region", { name: "Interactive Mars map" });
  await expect(map).toHaveAttribute("data-ready", "true");
  await expect(page.getByRole("heading", { name: "Jezero Crater", exact: true })).toBeVisible();
  const resolution = Number(await map.getAttribute("data-resolution"));
  expect(resolution).toBeLessThan(0.03);
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await expect(page.locator(".point-label strong")).toHaveText(["Choose a start", "Choose a destination"]);
  await page.goto("/?place=unknown");
  await expect(map).toHaveAttribute("data-ready", "true");
  await expect(page.getByRole("heading", { name: "Explore Mars" })).toBeVisible();
  expect(Number(await map.getAttribute("data-resolution"))).toBeGreaterThan(0.2);
});

test("a planned point stays on the same pixel across tabs and the overlay defaults are independent", async ({ page }) => {
  await page.goto("/");
  const map = page.getByRole("region", { name: "Interactive Mars map" });
  await expect(map).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await page.getByRole("button", { name: "Set A on map" }).click();
  await page.keyboard.press("Enter");
  await expect(map).toHaveAttribute("data-start-pixel", /^\[/);
  const before = JSON.parse((await map.getAttribute("data-start-pixel"))!);
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await expect(page.getByLabel("Topography opacity")).toHaveValue("0.5");
  await page.getByRole("button", { name: /^Atmospheric temperature/ }).click();
  await expect(page.getByLabel("Scientific layer opacity")).toHaveValue("0.75");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  const after = JSON.parse((await map.getAttribute("data-start-pixel"))!);
  expect(Math.hypot(before[0] - after[0], before[1] - after[1])).toBeLessThan(1);
  await expect(page.locator(".point-label strong").first()).not.toContainText("Choose");
});
