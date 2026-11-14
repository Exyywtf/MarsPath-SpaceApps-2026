import { expect, test } from "@playwright/test";
import images from "../../data/gallery.json";

test("gallery loops both ways while preserving the map and showing the matching source", async ({ page }) => {
  const assetRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/images/gallery/")) assetRequests.push(new URL(request.url()).pathname);
  });
  await page.goto("/");
  const map = page.locator('#interactive-mars-map[data-ready="true"]');
  await expect(map).toBeAttached();
  expect(assetRequests).toEqual([]);
  await page.getByLabel("Search scientific destinations").fill("Mawrth");
  await page.locator(".destination").click();
  const gallery = page.getByRole("region", { name: "Mawrth Vallis imagery" });
  await expect(gallery).toHaveAttribute("data-slide", "1");
  await expect(map).toHaveAttribute("data-animating", "false");
  const center = await map.getAttribute("data-center");
  const previous = gallery.getByRole("button", { name: "Previous image" });
  await previous.click();
  await expect(gallery).toHaveAttribute("data-slide", "3");
  const expected = images.filter((item) => item.destinationId === "mawrth")[2];
  await expect(gallery.getByRole("link", { name: "Original image source" })).toHaveAttribute("href", expected.sourcePage);
  await expect(gallery.locator('.gallery-caption-item[aria-hidden="false"]')).toContainText(expected.credit);
  await previous.press("ArrowRight");
  await expect(gallery).toHaveAttribute("data-slide", "1");
  await expect(gallery).toHaveAttribute("data-rotating", "false");
  await expect(map).toHaveAttribute("data-center", center!);
  expect(new Set(assetRequests).size).toBe(3);
});

test("autoplay pauses on hover and focus and follows reduced motion", async ({ page }) => {
  await page.clock.install();
  await page.goto("/?place=mawrth");
  const gallery = page.getByRole("region", { name: "Mawrth Vallis imagery" });
  await expect(gallery).toHaveAttribute("data-rotating", "true");
  await expect.poll(() => gallery.locator("img").evaluateAll((nodes) => nodes.filter((node) => (node as HTMLImageElement).naturalWidth > 0).length)).toBe(3);
  await gallery.locator(".gallery-stage").hover();
  await page.clock.fastForward(6200);
  await expect(gallery).toHaveAttribute("data-slide", "1");
  await page.mouse.move(1, 1);
  await expect(gallery).toHaveAttribute("data-rotating", "true");
  await page.clock.fastForward(6200);
  await expect(gallery).toHaveAttribute("data-slide", "2");
  await gallery.getByRole("button", { name: "Previous image" }).focus();
  await page.clock.fastForward(6200);
  await expect(gallery).toHaveAttribute("data-slide", "2");
  await expect(gallery).toHaveAttribute("data-rotating", "false");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(gallery.getByRole("button", { name: "Play image rotation" })).toBeDisabled();
  await gallery.getByRole("button", { name: "Next image" }).press("Enter");
  await expect(gallery).toHaveAttribute("data-slide", "3");
});

test("a touch swipe changes the image while vertical scrolling stays native", async ({ browser, browserName, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto("/?place=eridania");
    await page.getByRole("button", { name: "Expand panel fully" }).tap();
    const gallery = page.getByRole("region", { name: "Eridania Basin imagery" });
    const view = page.getByRole("region", { name: "Destination details" });
    await expect(gallery).toHaveAttribute("data-slide", "1");
    if (browserName === "chromium") {
      const session = await context.newCDPSession(page);
      const stage = await gallery.locator(".gallery-stage").boundingBox();
      const x = stage!.x + stage!.width * .71, y = stage!.y + stage!.height * .38;
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (let step = 1; step <= 10; step++) await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - step * 18, y }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect(gallery).toHaveAttribute("data-slide", "2");
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y + 70 }] });
      for (let step = 1; step <= 9; step++) await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + 70 - step * 16 }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await session.detach();
    } else {
      await gallery.getByRole("button", { name: "Next image" }).tap();
      await view.focus();
      await page.keyboard.press("PageDown");
    }
    await expect.poll(() => view.evaluate((node) => node.scrollTop)).toBeGreaterThan(30);
    await expect(gallery).toHaveAttribute("data-slide", "2");
    await expect(gallery).toHaveAttribute("data-rotating", "false");
  } finally { await context.close(); }
});
