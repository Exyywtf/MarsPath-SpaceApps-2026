import { expect, test, type Page } from "@playwright/test";
import terrain from "../../public/processed/jezero.json";

const [start, end] = terrain.examples[0];
const mars = (page: Page) => page.getByRole("region", { name: "Interactive Mars map" });
const remove = (page: Page, label: "A" | "B") => page.getByRole("button", { name: `Remove point ${label}`, exact: true });
const exportRoute = (page: Page) => page.getByRole("button", { name: "Export route & provenance" });

async function pixel(page: Page, coordinate: number[]) {
  return mars(page).evaluate((node, [longitude, latitude]) => {
    const [lon, lat] = JSON.parse(node.dataset.center!);
    const resolution = Number(node.dataset.resolution), rect = node.getBoundingClientRect();
    const x = longitude + 360 * Math.round((lon - longitude) / 360);
    return { x: rect.x + rect.width / 2 + (x - lon) / resolution, y: rect.y + rect.height / 2 + (lat - latitude) / resolution };
  }, coordinate);
}

async function editRoute(page: Page) {
  const edit = page.getByRole("button", { name: "Edit route", exact: true });
  if (await edit.isVisible()) await edit.click();
}

async function applyA(page: Page) {
  const editor = page.locator(".point-editor").first();
  const coordinates = editor.getByRole("button", { name: "Coordinates", exact: true });
  if (await coordinates.getAttribute("aria-expanded") !== "true") await coordinates.click();
  await editor.getByLabel("A latitude", { exact: true }).fill(String(start[1]));
  await editor.getByLabel("A longitude", { exact: true }).fill(String(start[0]));
  await editor.getByRole("button", { name: "Apply A", exact: true }).click();
}

test("right-click removes only the hit endpoint and keeps ordered waypoints", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    document.addEventListener("contextmenu", (event) => {
      document.documentElement.dataset.contextPrevented = String(event.defaultPrevented);
      event.preventDefault(); // Keep the browser menu from covering subsequent test clicks.
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await page.getByRole("button", { name: "Try Jezero terrain example" }).click();
  await expect(exportRoute(page)).toBeEnabled();
  await editRoute(page);
  const a = await pixel(page, start), b = await pixel(page, end);
  await page.getByRole("button", { name: "Add waypoint" }).click();
  await page.mouse.click((a.x + b.x) / 2, (a.y + b.y) / 2 - 22);
  const stops = page.locator(".waypoint-row small");
  await expect(stops).toHaveCount(1);
  const saved = await stops.allTextContents();
  await page.mouse.click(a.x, a.y + 56, { button: "right" });
  await expect(page.locator("html")).toHaveAttribute("data-context-prevented", "false");
  await expect(remove(page, "A")).toHaveCount(1);
  await expect(remove(page, "B")).toHaveCount(1);
  await page.mouse.click(a.x, a.y, { button: "right" });
  await expect(page.locator("html")).toHaveAttribute("data-context-prevented", "true");
  await expect(remove(page, "A")).toHaveCount(0);
  await expect(remove(page, "B")).toHaveCount(1);
  await expect(exportRoute(page)).toHaveCount(0);
  expect(await stops.allTextContents()).toEqual(saved);
  await applyA(page);
  await page.mouse.click(b.x, b.y, { button: "right" });
  await expect(remove(page, "B")).toHaveCount(0);
  await expect(remove(page, "A")).toHaveCount(1);
  expect(await stops.allTextContents()).toEqual(saved);
  await page.getByRole("button", { name: "Swap A and B" }).click();
  await expect(remove(page, "A")).toHaveCount(0);
  await expect(remove(page, "B")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Recalculate", exact: true })).toBeDisabled();
});

test("keyboard removal invalidates exports through late replies and exact coordinate re-entry", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const held: { id: number; send: () => void }[] = [];
    const property = Object.getOwnPropertyDescriptor(Worker.prototype, "onmessage")!;
    Object.defineProperty(Worker.prototype, "onmessage", { ...property, set(listener: (event: MessageEvent) => void) {
      property.set!.call(this, (event: MessageEvent) => {
        if (document.documentElement.dataset.holdRoute && ["routes", "analysis"].includes(event.data.kind)) {
          held.push({ id: event.data.id, send: () => listener.call(this, event) });
          document.documentElement.dataset.heldId = String(event.data.id);
        } else listener.call(this, event);
      });
    } });
    window.addEventListener("release-route-test-replies", (event) => {
      const id = (event as CustomEvent<number>).detail;
      for (const entry of held.filter((reply) => !id || reply.id === id)) entry.send();
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await page.getByRole("button", { name: "Try Jezero terrain example" }).click();
  await expect(exportRoute(page)).toBeEnabled();
  await editRoute(page);
  await page.evaluate(() => { document.documentElement.dataset.holdRoute = "true"; });
  await page.getByRole("button", { name: "Recalculate", exact: true }).click();
  const heldId = () => page.locator("html").getAttribute("data-held-id").then(Number);
  await expect.poll(heldId).toBeGreaterThan(0);
  const stale = await heldId();
  await remove(page, "A").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Set A on map" })).toBeFocused();
  await expect(page.getByText("Point A removed.", { exact: true })).toHaveAttribute("role", "status");
  await expect(exportRoute(page)).toHaveCount(0);
  await applyA(page);
  await expect.poll(heldId).toBeGreaterThan(stale);
  await page.evaluate((id) => dispatchEvent(new CustomEvent("release-route-test-replies", { detail: id })), stale);
  await expect(exportRoute(page)).toHaveCount(0);
  await page.evaluate(() => {
    delete document.documentElement.dataset.holdRoute;
    dispatchEvent(new CustomEvent("release-route-test-replies"));
  });
  await expect(exportRoute(page)).toBeEnabled();
});

for (const viewport of [{ width: 390, height: 844 }, { width: 834, height: 1194 }]) {
  test(`endpoint touch removal keeps empty-map zoom at ${viewport.width}px`, async ({ browser, browserName, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      await page.goto("/");
      await page.getByRole("button", { name: "Directions", exact: true }).tap();
      await page.getByRole("button", { name: "Try Jezero terrain example" }).tap();
      await expect(exportRoute(page)).toBeEnabled();
      await editRoute(page);
      const a = await pixel(page, start), b = await pixel(page, end);
      const label = viewport.width === 390 ? "A" : "B";
      const otherLabel = label === "A" ? "B" : "A";
      const target = label === "A" ? a : b, other = label === "A" ? b : a;
      const resolution = await mars(page).getAttribute("data-resolution");
      await page.touchscreen.tap(target.x, target.y);
      await page.waitForTimeout(330);
      await expect(remove(page, label)).toHaveCount(1);
      if (browserName === "chromium") {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [other] });
        await page.waitForTimeout(350);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await expect(remove(page, otherLabel)).toHaveCount(1);
        // A drag moves the endpoint without becoming the first tap of a removal.
        const coordinate = page.locator(".point-editor").nth(otherLabel === "A" ? 0 : 1).locator("strong");
        const before = await coordinate.textContent();
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [other] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: other.x + 28, y: other.y }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await expect(coordinate).not.toHaveText(before!);
        await expect(remove(page, otherLabel)).toHaveCount(1);
        await cdp.detach();
      }
      await page.touchscreen.tap(target.x, target.y);
      await page.touchscreen.tap(target.x, target.y);
      await expect(remove(page, label)).toHaveCount(0);
      await expect(remove(page, otherLabel)).toHaveCount(1);
      await expect(exportRoute(page)).toHaveCount(0);
      await expect(mars(page)).toHaveAttribute("data-resolution", resolution!);
      await page.touchscreen.tap(target.x, target.y - 48);
      await page.touchscreen.tap(target.x, target.y - 48);
      await expect(mars(page)).not.toHaveAttribute("data-resolution", resolution!);
      await expect(remove(page, otherLabel)).toHaveCount(1);
    } finally { await context.close(); }
  });
}
