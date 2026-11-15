import { devices, expect, test } from "@playwright/test";
import { demo, repositoryUrl } from "../../lib/site";

test("shared navigation and demo dialog preserve focus, playback and volume", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const videoRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith(".mp4")) videoRequests.push(request.url());
  });

  for (const path of ["/", "/sources/", "/methodology/"]) {
    await page.goto(path);
    const utility = page.locator(".header-links");
    expect(await utility.locator(":scope > :is(a,button)").evaluateAll(links => links.map(link => link.getAttribute("title"))))
      .toEqual(["Scientific sources", "Methodology", "GitHub", "Watch demo", "Help"]);
    const github = utility.getByRole("link", { name: "MarsPath on GitHub (opens in a new tab)", exact: true });
    await expect(github).toHaveAttribute("href", repositoryUrl);
    await expect(github).toHaveAttribute("target", "_blank");
    await expect(github).toHaveAttribute("rel", "noopener noreferrer");
    const trigger = utility.getByRole("button", { name: "Watch demo" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: demo.title });
    await expect(dialog.getByRole("button", { name: "Close demo" })).toBeFocused();
    const video = dialog.locator("video");
    await expect(video).not.toHaveAttribute("src");
    await expect(dialog.getByRole("slider", { name: "Demo volume" })).toHaveValue("25");

    if (path === "/") {
      expect(videoRequests).toHaveLength(0);
      expect(await video.evaluate((node: HTMLVideoElement) => node.volume)).toBe(0.25);
      await dialog.getByRole("slider", { name: "Demo volume" }).fill("57");
      await dialog.getByRole("button", { name: "Play demo" }).press("Space");
      await expect(dialog.getByRole("button", { name: "Pause demo" })).toBeVisible();
      await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(0);
      expect(await video.evaluate((node: HTMLVideoElement) => node.volume)).toBe(0.57);
      await dialog.getByRole("button", { name: "Mute demo" }).click();
      await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.muted)).toBe(true);
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      expect(await page.locator(".demo-dialog video").evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
      await expect(trigger).toBeFocused();
      await trigger.click();
      await expect(dialog.getByRole("slider", { name: "Demo volume" })).toHaveValue("25");
      await expect(dialog.locator("video")).not.toHaveAttribute("src");
      await page.mouse.click(3, 3);
    } else {
      await dialog.getByRole("button", { name: "Close demo" }).click();
    }
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 568 }]) {
  test(`demo loading uses the calculation notice's position at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      const post = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (message, ...args: unknown[]) {
        if (message?.kind !== "calculate") Reflect.apply(post, this, [message, ...args]);
      };
    });
    const media = Promise.withResolvers<void>();
    await page.route(url => url.pathname === demo.video, async route => {
      await media.promise;
      await route.continue();
    });
    const measure = (node: Element) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        x: matchMedia("(max-width: 650px)").matches ? rect.left : rect.left + rect.width / 2,
        y: rect.top,
        left: style.left,
        top: style.top,
        duration: style.transitionDuration,
        easing: style.transitionTimingFunction,
      };
    };
    try {
      await page.goto("/?mission=jezero");
      await page.getByRole("button", { name: "Try validated mission example" }).click();
      const calculating = page.locator(".route-feedback").filter({ hasText: "Calculating routes…" });
      await expect(calculating).toHaveCSS("opacity", "1");
      const anchor = await calculating.evaluate(measure);

      await page.getByRole("button", { name: "Watch demo" }).click();
      const dialog = page.getByRole("dialog", { name: demo.title });
      const surface = dialog.locator(".dialog-surface");
      await surface.evaluate(async node => {
        await Promise.all(node.getAnimations().map(animation => animation.finished));
      });
      const before = (await surface.boundingBox())!;
      await dialog.getByRole("button", { name: "Play demo" }).click();
      const loading = dialog.locator(":scope > .demo-loading");
      await expect(loading).toHaveCSS("opacity", "1");
      const position = await loading.evaluate(measure);
      expect(position.left).toBe(anchor.left);
      expect(position.top).toBe(anchor.top);
      expect(position.x).toBeCloseTo(anchor.x, 0);
      expect(position.y).toBeCloseTo(anchor.y, 0);
      expect(position.duration).toBe(anchor.duration);
      expect(position.easing).toBe(anchor.easing);
      expect(position.y + (await loading.boundingBox())!.height).toBeLessThanOrEqual(before.y);
      expect(await surface.boundingBox()).toEqual(before);

      media.resolve();
      await expect(dialog.getByRole("button", { name: "Pause demo" })).toBeVisible();
      await expect(loading).toHaveCSS("opacity", "0");
    } finally {
      media.resolve();
    }
  });
}

test("direct watch page plays the approved demo end to end", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith(".mp4")) requests.push(request.url());
  });
  await page.goto("/demo/");
  await expect(page.getByRole("heading", { name: demo.title })).toBeVisible();
  const video = page.locator("video");
  await expect(video).not.toHaveAttribute("src");
  expect(requests).toHaveLength(0);
  const mediaGate = Promise.withResolvers<void>();
  await page.route(url => url.pathname === demo.video, async route => {
    await mediaGate.promise;
    await route.continue();
  });
  const loading = page.locator("body > .demo-loading");
  try {
    await page.getByRole("button", { name: "Play demo" }).click();
    await expect(loading).toHaveCSS("opacity", "1");
    await expect(loading).toHaveCSS("transition-property", "none");
  } finally {
    mediaGate.resolve();
  }
  await expect(video).toHaveAttribute("src", demo.video);
  await expect(loading).toHaveCSS("opacity", "0");
  await expect.poll(
    () => video.evaluate((node: HTMLVideoElement) => node.ended),
    { timeout: 42_000, intervals: [400, 1_000, 2_000] },
  ).toBe(true);
  const media = await video.evaluate((node: HTMLVideoElement) => ({
    duration: node.duration, width: node.videoWidth, height: node.videoHeight,
  }));
  expect(media.duration).toBeCloseTo(demo.duration, 2);
  // WebKit can expose the rendered dimensions. FFprobe checks the file's coded size.
  expect(media.width).toBeGreaterThan(0);
  expect(media.width / media.height).toBeCloseTo(16 / 9, 2);
});

test.describe("touch playback", () => {
  test.use({ viewport: { width: 390, height: 844 },
    userAgent: devices["iPhone 13"].userAgent, hasTouch: true, isMobile: true,
  });

  test("the quiet source uses device volume without double attenuation", async ({ page }) => {
    await page.goto("/demo/");
    expect(await page.locator("video").evaluate((node: HTMLVideoElement) => node.volume)).toBe(1);
    await expect(page.getByText("Use device volume")).toBeVisible();
    await expect(page.getByRole("slider", { name: "Demo volume" })).toHaveCount(0);
    await page.getByRole("button", { name: "Play demo" }).tap();
    await expect(page.locator("video")).toHaveAttribute("src", demo.quietVideo);
    await expect(page.getByRole("button", { name: "Pause demo" })).toBeVisible();
    await page.getByRole("slider", { name: "Seek through demo" }).fill("26");
    await expect.poll(() => page.locator("video").evaluate((node: HTMLVideoElement) => node.ended), { timeout: 9000 }).toBe(true);
  });
});
