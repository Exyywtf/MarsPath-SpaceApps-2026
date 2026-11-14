import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

declare global {
  interface Window {
    marsAnimations: Animation[];
    marsRevealSamples: { t: number; progress: number }[];
  }
}

const output = "tmp/v31-review/motion";

test("records start, middle and end states of the thirteen interaction types", async ({ page }) => {
  test.setTimeout(120000);
  await mkdir(output, { recursive: true });
  await page.addInitScript(() => localStorage.setItem("marspath-onboarded", "1"));
  await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:4333");
  const map = page.getByRole("region", { name: "Interactive Mars map" });
  await expect(map).toHaveAttribute("data-ready", "true");
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page.clock.install();
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100);

  async function capture(name: string, action: () => Promise<unknown>, times = [0, 90, 300]) {
    await action();
    await page.evaluate(() => {
      window.marsAnimations = document.getAnimations().filter((animation) =>
        animation.effect?.getTiming().iterations !== Infinity);
      for (const animation of window.marsAnimations) animation.pause();
    });
    let previousTime = 0;
    for (const time of times) {
      if (time) await page.clock.runFor(time - previousTime);
      previousTime = time;
      await page.evaluate((time) => {
        for (const animation of window.marsAnimations) {
          if (animation.playState === "idle") continue;
          const end = Number(animation.effect?.getComputedTiming().activeDuration ?? 0);
          if (time >= end) animation.finish();
          else animation.currentTime = time;
        }
      }, time);
      await page.screenshot({ path: output + "/" + name + "-" + time + ".png", timeout: 7000 });
    }
    await page.evaluate(() => {
      for (const animation of window.marsAnimations) {
        if (animation.playState !== "idle") animation.finish();
      }
      window.marsAnimations = [];
    });
  }

  await capture("tabs", () => page.getByRole("button", { name: "Directions", exact: true }).click());
  await capture("accordion", () => page.locator(".point-editor").first().locator("summary").click());
  await page.locator(".point-editor").first().locator("summary").click();
  await page.clock.runFor(300);
  await page.getByRole("button", { name: "Set A on map" }).click();
  await capture("marker", () => page.keyboard.press("Enter"));
  await page.getByRole("button", { name: "Replace draft with Jezero example" }).click();
  await page.clock.runFor(200);
  await expect(map).toHaveAttribute("data-reveal", "drawing");
  for (const [name, advance] of [["start", 0], ["middle", 550], ["end", 1500]] as const) {
    if (advance) await page.clock.runFor(advance);
    await page.screenshot({ path: output + "/route-" + name + ".png" });
  }
  await expect(map).toHaveAttribute("data-reveal", "complete");
  await capture("edit-route", () => page.getByRole("button", { name: "Edit route", exact: true }).click());
  await capture("results-scroll", () => page.getByRole("button", { name: "View results", exact: true }).click());
  await page.getByRole("combobox", { name: "Route profile", exact: true }).scrollIntoViewIfNeeded();
  await capture("profile", () => page.getByRole("combobox", { name: "Route profile", exact: true }).selectOption("temperature"));
  await expect(page.locator(".profile-units")).toContainText("Temperature");
  await capture("panel-close", () => page.getByRole("button", { name: "Close panel" }).click());
  await capture("panel-open", () => page.getByRole("button", { name: "Layers", exact: true }).click());
  await page.getByRole("button", { name: /^Atmospheric temperature/ }).click();
  await expect(map).toHaveAttribute("data-overlay", "temperature");
  await page.clock.runFor(300);
  await capture("layer", async () => {
    await page.getByRole("button", { name: /^Atmospheric pressure/ }).click();
    await expect(map).toHaveAttribute("data-overlay", "pressure");
  });
  await capture("layer-off", () => page.getByRole("button", { name: /^Atmospheric pressure/ }).click());
  await expect(map).toHaveAttribute("data-overlay", "none");
  await capture("help-open", () => page.getByRole("button", { name: /^Help/ }).click());
  await capture("help-close", () => page.getByRole("button", { name: "Close help" }).click());

  // Use real delayed worker replies to hold the calculation state, then release it.
  await page.clock.resume();
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await page.getByRole("button", { name: "Recalculate", exact: true }).evaluate((button: HTMLButtonElement) => {
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(message, options) {
      if (message.kind === "calculate") setTimeout(() => original.call(this, message, options as StructuredSerializeOptions), 550);
      else original.call(this, message, options as StructuredSerializeOptions);
    };
    window.marsRevealSamples = [];
    const map = document.getElementById("interactive-mars-map")!;
    let drawing = false;
    const started = performance.now();
    function sample(now: number) {
      if (map.dataset.reveal === "drawing") {
        drawing = true;
        window.marsRevealSamples.push({ t: now-started, progress: Number(map.dataset.revealProgress) });
      }
      if (!drawing || map.dataset.reveal !== "complete") requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
    button.click();
  });
  await expect(page.locator(".route-feedback")).toContainText("Calculating routes");
  await page.screenshot({ path: output + "/calculation.png" });
  await expect(map).toHaveAttribute("data-reveal", "complete");
  const samples = await page.evaluate(() => window.marsRevealSamples);
  expect(samples.length).toBeGreaterThan(15);
  expect(samples.every((sample, i) => !i || sample.progress >= samples[i-1].progress)).toBe(true);
  await writeFile(output + "/reveal-frames.json", JSON.stringify(samples, null, 2));
  await expect(page.locator(".factor-detail")).toHaveCount(4);
  const [download] = await Promise.all([
    page.waitForEvent("download"), page.getByRole("button", { name: "Export route & provenance" }).click(),
  ]);
  await download.saveAs(output + "/jezero-final.geojson");

  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.getByRole("button", { name: "Recenter global map" }).click();
  await expect.poll(async () => Number(await map.getAttribute("data-resolution"))).toBeGreaterThan(0.2);
  await expect(map).toHaveAttribute("data-animating", "false");
  const resolution = Number(await map.getAttribute("data-resolution"));
  const zoom = Math.log2((360 / 256) / resolution);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 80);
  for (let i = 0; i < Math.ceil(4.2-zoom)-1; i++) {
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await page.clock.runFor(250);
  }
  await capture("poi-labels", () => page.getByRole("button", { name: "Zoom in", exact: true }).click(), [0, 210, 500]);
  await page.clock.resume();
  await page.getByRole("link", { name: "Scientific sources" }).click();
  await page.getByRole("heading", { name: "Evidence behind the exploration" }).waitFor();
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 80);
  await capture("sources-accordion", () => page.locator(".source-record").first().locator("summary").click());
  await capture("page-navigation", async () => {
    await page.getByRole("link", { name: "Methodology", exact: true }).click();
    await expect(page.getByRole("heading", { name: "MarsPath methodology" })).toBeVisible();
  });
  await page.clock.resume();
  await writeFile(output + "/capture-context.json", JSON.stringify({
    viewport: page.viewportSize(), browser: "Chromium",
    timing: "JavaScript clock paused between storyboard frames. Finite CSS animation timelines set to 0, 90 and 300 ms. Route frames advance the animation clock by 550 and 1500 ms.",
    limitation: "Storyboard screenshots verify geometry and presentation. Frame-rate measurements use the separate real-time profiling journey.",
  }, null, 2));
});
