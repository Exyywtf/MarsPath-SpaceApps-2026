import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

const viewports = [[1920, 1080], [1440, 900], [1024, 768], [834, 1194], [1194, 834], [390, 844], [375, 667], [844, 390], [320, 568]];

test("mission navigation and populated metrics align across desktop, tablet and phone layouts", async ({ page, browserName }, testInfo) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const captures = testInfo.outputPath("views");
  await mkdir(captures, { recursive: true });
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto("/?mission=jezero");
    const navigation = page.getByRole("navigation", { name: "Atlas tools" }).getByRole("button");
    await expect(navigation).toHaveCount(4);
    for (const [i, name] of ["Explore", "Directions", "Mission Planner", "Layers"].entries()) {
      await expect(navigation.nth(i)).toHaveAccessibleName(name);
      if (i === 0) await navigation.nth(i).focus();
      else await page.keyboard.press("Tab");
      await expect(navigation.nth(i)).toBeFocused();
    }
    await page.getByRole("button", { name: "Try validated mission example" }).click();
    await expect(page.getByText("Return · B to A", { exact: true })).toBeVisible();
    await expect(page.locator(".mission-journey h2")).toHaveCSS("font-size", "18px");
    for (const row of await page.locator(".mission-journey dl > div").all()) {
      const offsets = await row.evaluate((el) => {
        const label = el.querySelector("dt")!.getBoundingClientRect();
        const value = el.querySelector("dd")!.getBoundingClientRect();
        return { left: Math.abs(label.left - value.left), below: value.top - label.bottom };
      });
      expect(offsets.left).toBeLessThan(1);
      expect(offsets.below).toBeGreaterThanOrEqual(5);
      await expect(row.locator("strong")).toHaveCSS("white-space", "nowrap");
    }
    const totals = await page.locator(".mission-totals").evaluate((el) => ({
      columns: getComputedStyle(el).gridTemplateColumns.split(" ").length,
      cardWidth: el.parentElement!.clientWidth - 32,
    }));
    expect(totals.columns).toBe(totals.cardWidth >= 480 ? 2 : 1);
    if (totals.columns === 2) {
      const tops = await page.locator(".mission-totals strong").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
      expect(Math.abs(tops[0] - tops[1])).toBeLessThan(1);
    }
    await page.locator(".mission-journey").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${captures}/${browserName}-${width}-journey.png` });
    await page.getByRole("button", { name: "What changes this recommendation?" }).click();
    await page.getByRole("button", { name: "Science first", exact: true }).click();
    await expect(page.locator(".route-option.selected")).toContainText("Science-aware route");
    await page.locator(".mission-journey").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${captures}/${browserName}-${width}-science.png` });
    await page.getByRole("button", { name: "Daylight & departure" }).click();
    await expect(page.getByLabel("Inspect daylight on map")).toBeVisible();
    await page.locator(".mission-daylight").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${captures}/${browserName}-${width}-daylight.png` });
    const overflow = await page.locator('.mission-panel [data-active="true"] .panel-scroll').evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.locator(".plan-summary")).toHaveCSS("margin-top", "24px");
  }
});

test("mission setup spacing survives rapid disclosures, editing and workflow switches", async ({ page }) => {
  await page.goto("/?mission=jezero");
  await page.getByRole("button", { name: "Try validated mission example" }).click();
  await expect(page.getByText("Return · B to A", { exact: true })).toBeVisible();
  const map = page.locator("#interactive-mars-map");
  await expect(map).toHaveAttribute("data-animating", "false");
  const camera = await map.getAttribute("data-center");
  const endpoints = await page.locator(".point-label strong").allTextContents();
  const destinations = page.getByRole("button", { name: "Choose endpoints from destinations", exact: true });
  await destinations.scrollIntoViewIfNeeded();
  await destinations.click();
  await page.getByLabel("Start destination (A)").waitFor();
  await destinations.click();
  await destinations.click();
  await destinations.click();
  await expect(destinations).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Travel assumptions", exact: true }).click();
  const spacing = await destinations.evaluate((el) => {
    const section = el.closest(".accordion")!;
    return section.nextElementSibling!.getBoundingClientRect().top - section.getBoundingClientRect().bottom;
  });
  expect(spacing).toBeCloseTo(16, 0);
  const travelBody = page.getByLabel("Speed (km/h)", { exact: true }).locator("xpath=ancestor::div[contains(@class,'accordion-body')][1]");
  await expect(travelBody).toHaveAttribute("aria-hidden", "true");
  await expect.poll(async () => (await travelBody.boundingBox())!.height).toBe(0);
  await page.getByRole("button", { name: "Travel assumptions", exact: true }).click();
  await expect(page.getByLabel("Speed (km/h)", { exact: true })).toHaveValue("2");
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.getByRole("button", { name: "Mission Planner", exact: true }).click();
  await expect(map).toHaveAttribute("data-center", camera!);
  await expect(page.locator(".point-label strong")).toHaveText(endpoints);
  await expect(page.locator(".mission-journey")).toContainText("5.75 km");
  await page.getByRole("button", { name: "Travel assumptions", exact: true }).focus();
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations.map(({ id }) => id)).toEqual([]);
});
