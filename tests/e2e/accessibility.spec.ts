import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("accessible explore, directions, layers and modal states", async ({
  page,
}) => {
  await page.goto("/");
  const check = async () => {
    await page.evaluate(() => Promise.all(document.getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      .map((animation) => animation.finished.catch(() => undefined))));
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  };
  await check();
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await page
    .getByRole("button", { name: "Try Jezero terrain example" })
    .click();
  await expect(page.locator(".route-option")).toHaveCount(3);
  await check();
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.getByRole("button", { name: /^Atmospheric pressure/ }).click();
  await check();
  await page
    .getByRole("button", { name: "Help and keyboard shortcuts" })
    .click();
  await check();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Help and keyboard shortcuts" }),
  ).toBeFocused();
});
test("keyboard placement, Escape hierarchy, shortcuts and reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  const map = page.getByRole("region", { name: "Interactive Mars map" });
  await page.getByRole("button", { name: "Set A on map" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".placement-instruction")).toHaveCount(0);
  await expect(page.locator(".workflow-panel h1")).toHaveText("Directions");
  await page.getByRole("button", { name: "Set A on map" }).click();
  await expect(map).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".point-label strong").first()).not.toContainText(
    "Choose",
  );
  await page.keyboard.press("/");
  await expect(page.getByLabel("Search scientific destinations")).toBeFocused();
  await page.keyboard.type("R");
  await expect(page.locator(".workflow-panel h1")).toHaveText("Explore Mars");
  await page.getByLabel("Search scientific destinations").fill("Jezero");
  await page.locator(".destination").click();
  await expect(map).toHaveAttribute("data-animating", "false");
  await page.setViewportSize({ width: 390, height: 844 });
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
});
test("map placement waits for the map bundle when Directions opens first", async ({
  page,
}) => {
  let releaseMap!: () => void;
  const held = new Promise<void>((resolve) => {
    releaseMap = resolve;
  });
  await page.route(/\/_next\/static\/(?:immutable\/)?chunks\/[^?#]+\.js(?:[?#]|$)/, async (route) => {
    const response = await route.fetch();
    if ((await response.text()).includes("MARSPATH:2000")) await held;
    await route.fulfill({ response });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const directions = page.getByRole("button", { name: "Directions", exact: true });
  // Static buttons can render before React attaches their event handlers.
  await expect(async () => {
    await directions.click();
    await expect(directions).toHaveAttribute("aria-pressed", "true", { timeout: 600 });
  }).toPass({ timeout: 7000 });
  const setA = page.getByRole("button", { name: "Set A on map", exact: true });
  try {
    await expect(setA).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Try Jezero terrain example" }),
    ).toBeDisabled();
  } finally {
    releaseMap();
  }
  await setA.click();
  const map = page.getByRole("region", { name: "Interactive Mars map" });
  await expect(map).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".point-label strong").first()).not.toContainText(
    "Choose",
  );
});
