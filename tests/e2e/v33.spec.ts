import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import sources from "../../data/sources.json";

test("scrollbar fades independently of resize and stays visible during capture", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?place=mawrth");
  const view = page.getByRole("region", { name: "Destination details" });
  const track = page.locator('.workflow-view[data-active="true"] .scroll-track');
  const image = page.locator(".location-image");
  const width = (await image.boundingBox())!.width;
  await expect(track).toHaveCSS("opacity", "0");
  const trigger = page.getByRole("button", { name: "About this position" });
  await trigger.evaluate((node: HTMLButtonElement) => node.click());
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await trigger.evaluate(async (node) => {
    const body = document.getElementById(node.getAttribute("aria-controls")!)!;
    await Promise.all(body.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
    await new Promise(requestAnimationFrame);
  });
  await expect(track).toHaveAttribute("data-visible", "false");
  await view.evaluate((node) => { node.scrollTop = 32; });
  await expect(track).toHaveAttribute("data-visible", "true");
  await expect(track).toHaveCSS("transition-duration", "0.2s");
  await view.evaluate(async (node) => {
    for (let i = 0; i < 8; i++) {
      node.scrollTop += 5;
      await new Promise(requestAnimationFrame);
    }
  });
  await expect(track).toHaveCSS("opacity", "1");
  const thumb = (await track.locator(".scroll-thumb").boundingBox())!;
  await page.mouse.move(thumb.x + 12, thumb.y + 12);
  await page.mouse.down();
  await page.waitForTimeout(1100);
  await expect(track).toHaveCSS("opacity", "1");
  await page.mouse.move(thumb.x + 12, thumb.y + 54, { steps: 5 });
  await page.mouse.up();
  expect(await view.evaluate((node) => node.scrollTop)).toBeGreaterThan(90);
  await page.mouse.move(1, 1);
  await expect(track).toHaveAttribute("data-visible", "false");
  await expect(track).toHaveCSS("transition-duration", "0.3s");
  await expect(track).toHaveCSS("pointer-events", "none");
  await view.evaluate((node) => { node.scrollTop = 0; });
  await expect(track).toHaveCSS("opacity", "1");
  expect((await image.boundingBox())!.width).toBe(width);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(track).toHaveCSS("transition-duration", "0s");
  await expect(track).toHaveCSS("opacity", "0");
});

test("Sources listbox centres each row and supports keyboard and outside dismissal", async ({ page }) => {
  await page.goto("/sources/");
  const filter = page.getByRole("button", { name: /Filter source type/ });
  const menu = page.getByRole("listbox");
  const options = menu.getByRole("option");
  const centerOffset = (node: Element) => {
    const row = node.getBoundingClientRect(), text = node.querySelector("span")!.getBoundingClientRect();
    return Math.abs(text.x + text.width / 2 - row.x - row.width / 2);
  };
  expect(await filter.evaluate(centerOffset)).toBeLessThan(0.5);
  const triggerBox = (await filter.boundingBox())!;
  await filter.focus();
  await page.keyboard.press("Space");
  await expect(menu).toBeFocused();
  expect(await options.allTextContents()).toEqual(["All", ...new Set(sources.map((source) => source.type))]);
  for (const option of await options.all()) {
    expect(await option.evaluate(centerOffset)).toBeLessThan(0.5);
    expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(filter).toHaveText("Peer-reviewed geology");
  await expect(filter).toBeFocused();
  expect((await filter.boundingBox())!.width).toBe(triggerBox.width);
  expect(await filter.evaluate(centerOffset)).toBeLessThan(0.5);
  await expect(page.locator(".source-count")).toHaveText("1 source");
  await filter.press("ArrowDown");
  const selected = menu.getByRole("option", { selected: true });
  await expect(selected).toHaveText("Peer-reviewed geology");
  expect(await selected.evaluate(centerOffset)).toBeLessThan(0.5);
  await menu.evaluate((node) => Promise.all(node.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((node) => node.target) }))).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(filter).toBeFocused();
  await filter.press("Space");
  await expect(menu).toBeFocused();
  await page.keyboard.type("Modelled");
  await page.keyboard.press("Enter");
  await expect(filter).toHaveText("Modelled climate");
  await filter.press("Space");
  await expect(menu).toBeFocused();
  await page.keyboard.press("Home");
  await page.keyboard.press("Space");
  await expect(filter).toHaveText("All");
  await filter.press("ArrowUp");
  await page.keyboard.press("Tab");
  await expect(menu).toBeHidden();
  await expect(filter).not.toBeFocused();
  await filter.click();
  await page.getByRole("textbox", { name: "Search sources" }).click();
  await expect(menu).toBeHidden();
  await expect(page.getByRole("textbox", { name: "Search sources" })).toBeFocused();
});
