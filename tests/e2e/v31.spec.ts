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
        headerFits: [...document.querySelectorAll(".topbar a, .topbar button")].every((control) => {
          const rect = control.getBoundingClientRect();
          const header = document.querySelector(".topbar")!.getBoundingClientRect();
          return rect.left >= header.left && rect.right <= header.right;
        }),
      };
    });
    expect(fit.edges.west, `${width} × ${height} west`).toBeGreaterThan(fit.frame.left);
    expect(fit.edges.east, `${width} × ${height} east`).toBeLessThan(fit.frame.right);
    expect(fit.edges.north, `${width} × ${height} north`).toBeGreaterThan(fit.frame.top);
    expect(fit.edges.south, `${width} × ${height} south`).toBeLessThan(fit.frame.bottom);
    expect(fit.fitsPage).toBe(true);
    expect(fit.headerFits, `${width} × ${height} header`).toBe(true);
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
  await page.getByRole("button", { name: "Recenter global map" }).click();
  await expect.poll(async () => Number(await map.getAttribute("data-resolution"))).toBeGreaterThan(0.2);
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

test("rapid layer switching rejects stale images and failed overlays can be retried", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const slowImage = /processed\/mcd-temperature[^/]*\.png$/;
  await page.route(slowImage, async (route) => { await held; await route.continue(); }, { times: 1 });
  await page.route(/processed\/mcd-wind[^/]*\.png$/, (route) => route.abort(), { times: 1 });
  await page.goto("/");
  const map = page.getByRole("region", { name: "Interactive Mars map" });
  await expect(map).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  const slow = page.waitForRequest((request) => slowImage.test(request.url()));
  await page.getByRole("button", { name: /^Atmospheric temperature/ }).click();
  await slow;
  await page.getByRole("button", { name: /^Atmospheric pressure/ }).click();
  await expect(map).toHaveAttribute("data-overlay", "pressure");
  release();
  await page.getByRole("button", { name: /^Horizontal wind speed/ }).click();
  await expect(page.getByRole("button", { name: "Retry overlay" })).toBeVisible();
  await expect(page.locator(".map-legend")).toContainText("Atmospheric pressure");
  await page.getByRole("button", { name: "Retry overlay" }).click();
  await expect(page.locator(".map-legend")).toContainText("Horizontal wind speed");
  await expect(map).toHaveAttribute("data-overlay", "wind");
  await page.getByRole("button", { name: /^Horizontal wind speed/ }).click();
  await expect(page.locator(".map-legend")).toHaveCount(0);
  await expect(map).toHaveAttribute("data-overlay", "none");
});

test("workflow controls and scroll position survive tab switches and closing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  const editor = page.locator(".point-editor").first();
  await editor.locator(".accordion-trigger").click();
  await page.getByLabel("A latitude", { exact: true }).fill("18.425");
  const scroll = page.locator('[data-active="true"] .panel-scroll');
  await scroll.evaluate((node) => node.scrollTop = 70);
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await expect(page.getByLabel("A latitude", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await expect(page.getByLabel("A latitude", { exact: true })).toHaveValue("18.425");
  expect(await scroll.evaluate((node) => node.scrollTop)).toBe(70);
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.getByRole("complementary", { name: "Directions" })).toBeHidden();
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await expect(page.getByLabel("A latitude", { exact: true })).toHaveValue("18.425");
  expect(await scroll.evaluate((node) => node.scrollTop)).toBe(70);
});

test("touch Help centres on phones and tablets, and Sources and Methodology stay navigable", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    for (const [width, height] of [[390, 844], [375, 667], [844, 390], [834, 1194], [1194, 834]]) {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      const help = page.getByRole("button", { name: /^Help/ });
      await help.tap();
      const dialog = page.getByRole("dialog", { name: "Your guide to MarsPath" });
      await expect(dialog.getByRole("heading", { name: "Explore Mars" })).toBeVisible();
      await expect(dialog.getByRole("heading", { name: "Keyboard shortcuts" })).toBeHidden();
      const surface = dialog.locator(".dialog-surface");
      await expect.poll(async () => {
        const rect = (await surface.boundingBox())!;
        return Math.round(Math.max(Math.abs(rect.x + rect.width / 2 - width / 2), Math.abs(rect.y + rect.height / 2 - height / 2)));
      }).toBeLessThanOrEqual(1);
      await dialog.getByRole("heading", { name: "Plan a route" }).tap();
      await expect(dialog).toBeVisible();
      await page.touchscreen.tap(4, 4);
      await expect(dialog).toBeHidden();
      await expect(help).toBeFocused();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const help = page.getByRole("button", { name: /^Help/ });
    await help.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(help).toBeFocused();

    await page.getByRole("link", { name: "Scientific sources" }).tap();
    await expect(page.getByRole("heading", { name: "Evidence behind the exploration" })).toBeVisible();
    const filter = page.getByLabel("Filter source type");
    await filter.selectOption("Historical illustration");
    await expect(page.locator(".source-count")).toHaveText("1 source");
    for (const control of [filter, page.locator(".source-count"), page.locator(".source-search .search")]) {
      const box = (await control.boundingBox())!;
      expect(Math.abs(box.x + box.width / 2 - 195)).toBeLessThan(1);
    }
    await page.locator("#pia03480 .accordion-trigger").tap();
    await expect(page.locator("#pia03480 .provenance-row").last()).toBeVisible();
    await page.getByRole("link", { name: "Methodology", exact: true }).tap();
    await expect(page.getByRole("heading", { name: "MarsPath methodology" })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Evidence behind the exploration" })).toBeVisible();
  } finally { await context.close(); }
});
