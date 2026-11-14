import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const region = (page: Page) => page.getByRole("region", { name: "Interactive Mars map" });
const example = (page: Page) => page.getByRole("button", { name: "Try Jezero terrain example" });
const headingOffset = (page: Page) => page.locator("#compare-routes").evaluate((heading) =>
  Math.round(heading.getBoundingClientRect().top - heading.closest(".panel-scroll")!.getBoundingClientRect().top),
);

test("draws a monotonic prefix and makes full export available before it settles", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await example(page).click();
  const map = region(page);
  await expect(map).toHaveAttribute("data-reveal", "drawing");
  const start = Number(await map.getAttribute("data-reveal-progress"));
  await expect.poll(async () => Number(await map.getAttribute("data-reveal-progress"))).toBeGreaterThan(start + .1);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export route & provenance" }).evaluate((button: HTMLButtonElement) => button.click()),
  ]);
  const parsed = JSON.parse(await readFile((await download.path())!, "utf-8"));
  const line = parsed.geometry ?? parsed.features[0].geometry;
  expect(line.coordinates.flat().length).toBeGreaterThan(50);
  const skip = page.getByRole("button", { name: "Skip reveal" });
  if (await skip.isVisible()) await skip.click();
  await expect(map).toHaveAttribute("data-reveal", "complete");
  await expect.poll(async () => Math.abs(await headingOffset(page) - 20)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const panel = page.locator('[data-active="true"] .panel-scroll');
  await panel.evaluate((element) => element.scrollTop += 56);
  const previous = await panel.evaluate((element) => element.scrollTop);
  await page.locator(".route-option").nth(1).evaluate((button: HTMLButtonElement) => button.click());
  await expect(map).toHaveAttribute("data-reveal", "complete");
  expect(await panel.evaluate((element) => element.scrollTop)).toBe(previous);
});

test("reduced motion and a collapsed mobile sheet complete without a reveal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await example(page).click();
  await expect(region(page)).toHaveAttribute("data-reveal", "complete");
  await expect(page.getByRole("button", { name: "Skip reveal" })).toHaveCount(0);
  await expect.poll(async () => Math.abs(await headingOffset(page) - 20)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("a wheel gesture during a delayed calculation keeps the panel under user control", async ({ page }) => {
  let releaseTerrain!: () => void;
  const held = new Promise<void>((resolve) => { releaseTerrain = resolve; });
  await page.route(/jezero.*elevation\.f32$/, async (route) => { await held; await route.continue(); });
  await page.goto("/");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await example(page).click();
  await expect(page.locator(".route-status")).toContainText("Calculating");
  const panel = page.locator('[data-active="true"] .panel-scroll');
  await panel.dispatchEvent("wheel", { deltaY: 90 });
  const previous = await panel.evaluate((element) => element.scrollTop);
  releaseTerrain();
  await expect(region(page)).toHaveAttribute("data-reveal", "complete");
  expect(await panel.evaluate((element) => element.scrollTop)).toBe(previous);
  await page.getByRole("button", { name: "View results", exact: true }).click();
  await expect.poll(async () => Math.abs(await headingOffset(page) - 20)).toBeLessThanOrEqual(1);
});

test("editing during a calculation keeps coordinate errors and the planner visible", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route(/jezero.*elevation\.f32$/, async (route) => { await held; await route.continue(); });
  await page.goto("/");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await example(page).click();
  await expect(page.locator(".route-status")).toContainText("Calculating");
  await page.locator(".point-editor").first().locator("summary").click();
  await page.getByLabel("A latitude", { exact: true }).fill("91");
  await page.getByRole("button", { name: "Apply A", exact: true }).click();
  await expect(page.locator(".field-error")).toContainText("Latitude");
  // A pointer click can leave focus outside the editor in WebKit.
  await page.locator("#workflow-title").focus();
  release();
  await expect(region(page)).toHaveAttribute("data-reveal", "complete");
  await expect(page.locator(".field-error")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add waypoint", exact: true })).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test("recalculating during a reveal cancels it and reveals the new accepted result", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await example(page).click();
  const map = region(page);
  await expect(map).toHaveAttribute("data-reveal", "drawing");
  await expect.poll(async () => Number(await map.getAttribute("data-reveal-progress"))).toBeGreaterThan(.15);
  await page.getByRole("button", { name: "Recalculate", exact: true }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(map).toHaveAttribute("data-reveal", "idle", { timeout: 1000 });
  await expect(map).toHaveAttribute("data-reveal", "drawing");
  await expect(map).toHaveAttribute("data-reveal", "complete");
  await expect(page.locator(".route-option")).toHaveCount(3);
});

test("recalculation preserves the comparison and Edit route reopens the inputs", async ({ page }) => {
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      postMessage(message: { kind: string }) {
        if (message.kind === "calculate" && document.documentElement.dataset.holdRoute)
          setTimeout(() => super.postMessage(message), 600);
        else super.postMessage(message);
      }
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await example(page).click();
  await expect(region(page)).toHaveAttribute("data-reveal", "complete");
  await expect.poll(async () => Math.abs(await headingOffset(page) - 20)).toBeLessThanOrEqual(1);
  const comparisonOffset = await headingOffset(page);
  await page.evaluate(() => { document.documentElement.dataset.holdRoute = "true"; });
  const exportButton = page.getByRole("button", { name: "Export route & provenance" });
  await page.getByRole("button", { name: "Recalculate", exact: true })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator(".route-feedback")).toContainText("Calculating routes");
  await expect(page.locator(".route-option")).toHaveCount(3);
  await expect(exportButton).toBeDisabled();
  expect(await headingOffset(page)).toBe(comparisonOffset);
  await expect(region(page)).toHaveAttribute("data-reveal", "drawing");
  await expect(exportButton).toBeEnabled();
  expect(await headingOffset(page)).toBe(comparisonOffset);
  await page.getByRole("button", { name: "Edit route" }).click();
  await expect(page.locator("#planning-heading")).toBeFocused();
  await expect.poll(() => page.locator('[data-active="true"] .panel-scroll').evaluate((node) => node.scrollTop)).toBe(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test("featured Jezero survives filtering and opening Directions preserves the draft", async ({ page }) => {
  await page.goto("/");
  await expect(region(page)).toHaveAttribute("data-animating", "false");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await page.locator(".point-editor").first().locator("summary").click();
  await page.getByLabel("A latitude", { exact: true }).fill("18.466");
  await page.getByLabel("A longitude", { exact: true }).fill("77.419");
  await page.getByRole("button", { name: "Apply A", exact: true }).click();
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.locator(".place-filters summary").click();
  await page.getByRole("button", { name: "Clays", exact: true }).click();
  const card = page.getByRole("region", { name: "Jezero Crater" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Plan detailed route" }).click();
  await expect(page.locator(".point-label strong").first()).toContainText("77.419°E");
  await expect(page.getByRole("button", { name: "Replace draft with Jezero example" })).toBeVisible();
  await expect(region(page)).toHaveAttribute("data-animating", "false");
  await expect.poll(async () => Number(await region(page).getAttribute("data-resolution"))).toBeLessThan(0.005);
});
