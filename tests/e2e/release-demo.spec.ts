import { devices, expect, test } from "@playwright/test";
import { demo } from "../../lib/site";

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
      .toEqual(["Scientific sources", "Methodology", ...(await utility.getByTitle("GitHub").count() ? ["GitHub"] : []), "Watch demo", "Help"]);
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

test("direct watch page plays the approved demo end to end", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith(".mp4")) requests.push(request.url());
  });
  await page.goto("/demo/");
  await expect(page.getByRole("heading", { name: demo.title })).toBeVisible();
  const video = page.locator("video");
  await expect(video).not.toHaveAttribute("src");
  expect(requests).toHaveLength(0);
  await page.getByRole("button", { name: "Play demo" }).click();
  await expect(video).toHaveAttribute("src", demo.video);
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
