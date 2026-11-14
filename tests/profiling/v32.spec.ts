import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";

const sizes = [[1920,1080],[1440,900],[1366,768],[1024,768],[834,1194],[1194,834],[390,844],[375,667],[844,390]];
const output = "tmp/v32-review";
const button = (page: Page, name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
const map = (page: Page) => page.getByRole("region", { name: "Interactive Mars map" });
const shot = (page: Page, file: string) => page.screenshot({ path: output + "/" + file + ".png", timeout: 7500 });
const percentile = (values: number[], p: number) => [...values].sort((a,b) => a-b)[Math.max(0, Math.ceil(values.length * p) - 1)] ?? 0;

type Recorder = { active: boolean; frames: number[]; longTasks: number[]; resultMs?: number };
declare global { interface Window { marsUI: Recorder } }

async function startRoute(page: Page) {
  await button(page, "Directions").click();
  await button(page, "Try Jezero terrain example").click();
  await expect(button(page, "Export route & provenance")).toBeEnabled();
  await expect(map(page)).toHaveAttribute("data-animating", "false");
  await expect(map(page)).toHaveAttribute("data-reveal", "complete");
}

async function measure(context: BrowserContext, url: string, cacheSize: () => number) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url);
  await startRoute(page);
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(({name,value}) => [name,value]));
  const recalc = button(page, "Recalculate");
  const results = [];
  // Warm the worker and camera first. Clear the view's pending render work before each trial.
  await recalc.click();
  await expect(map(page)).toHaveAttribute("data-reveal", "drawing");
  await expect(map(page)).toHaveAttribute("data-reveal", "complete");
  for (let i = 0; i < 3; i++) {
    const before = await metrics();
    const misses = cacheSize();
    await page.evaluate(() => {
      window.marsUI = { active: true, frames: [], longTasks: [] };
      const root = document.querySelector(".directions-content")!;
      const trigger = Array.from(root.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Recalculate")!;
      const started = performance.now();
      const accepted = new MutationObserver(() => {
        const exportButton = root.querySelector<HTMLButtonElement>('[aria-label="Export route & provenance"]');
        if (exportButton && !exportButton.disabled && root.querySelector(".route-status")?.textContent?.includes("Routes ready")) {
          window.marsUI.resultMs = performance.now() - started;
          accepted.disconnect();
        }
      });
      accepted.observe(root, { subtree: true, attributes: true, childList: true });
      trigger.click();
    });
    await expect(map(page)).toHaveAttribute("data-reveal", "drawing");
    for (let step = 0; step < 48; step++) {
      await page.mouse.move(930+Math.sin(step/7)*90,315+Math.cos(step/11)*72);
      await page.waitForTimeout(15);
    }
    await expect(map(page)).toHaveAttribute("data-reveal", "complete");
    const data = await page.evaluate(() => { window.marsUI.active = false; return window.marsUI; });
    const after = await metrics(), intervals = data.frames.slice(1).map((t, i) => t - data.frames[i]);
    expect(data.resultMs).toBeGreaterThan(100);
    results.push({
      resultMs: data.resultMs,
      frameP95Ms: percentile(intervals, .95),
      frameCount: intervals.length,
      longTasks: data.longTasks.length,
      longestTaskMs: Math.max(0, ...data.longTasks),
      scriptMs: (after.ScriptDuration-before.ScriptDuration)*1000,
      layoutMs: (after.LayoutDuration-before.LayoutDuration)*1000,
      heapBytes: after.JSHeapUsedSize,
      nasaMisses: cacheSize() - misses,
    });
  }
  await page.getByText("Data quality & coverage", { exact: true }).click();
  const worker = await page.locator(".quality-details dd").filter({ hasText: "cached legs" }).last().textContent();
  await page.close();
  return { results, worker };
}

test("captures V3.1 and V3.2 across the release viewports and profiles both static builds", async ({ browser }) => {
  test.setTimeout(180000);
  await mkdir(output, { recursive: true });
  const nasa = new Map<string, { status: number; headers: Record<string,string>; body: Buffer }>();
  const live: number[] = [], builds = [];
  for (const [version, url] of [
    ["before", process.env.V31_BASE_URL ?? "http://127.0.0.1:4334"],
    ["after", process.env.BASE_URL ?? "http://127.0.0.1:4333"],
  ]) {
    const context = await browser.newContext();
    await context.route("https://trek.nasa.gov/tiles/**", async (route) => {
      const url = route.request().url(), cached = nasa.get(url);
      if (cached) return route.fulfill(cached);
      const started = Date.now();
      try {
        const response = await route.fetch({ timeout: 5000 });
        const result = { status: response.status(), headers: response.headers(), body: await response.body() };
        if (response.ok()) { nasa.set(url, result); live.push(Date.now()-started); }
        return await route.fulfill(result);
      } catch { await route.abort(); }
    });
    await context.addInitScript(() => {
      localStorage.setItem("marspath-onboarded","1");
      sessionStorage.removeItem("marspath-draft-v2");
      window.marsUI = { active: false, frames: [], longTasks: [] };
      const tick = (now: number) => {
        if (window.marsUI.active) window.marsUI.frames.push(now);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      new PerformanceObserver((list) => {
        if (window.marsUI.active) window.marsUI.longTasks.push(...list.getEntries().map((entry) => entry.duration));
      }).observe({ type:"longtask" });
    });
    const page = await context.newPage();
    for (const [width, height] of process.env.MARSPATH_PROFILE_ONLY === "1" ? [] : sizes) {
      const size = width + "x" + height;
      await page.setViewportSize({ width, height });
      await page.goto(url);
      await expect(map(page)).toHaveAttribute("data-animating", "false");
      await page.waitForLoadState("networkidle", { timeout: 4500 }).catch(() => {});
      await shot(page, version + "-explore-" + size);
      await startRoute(page);
      await shot(page, version + "-route-" + size);
      await button(page, /^Help/).click();
      await page.locator(".help-dialog").evaluate((dialog) =>
        Promise.all(dialog.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined))));
      await shot(page, version + "-help-" + size);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
      await page.goto(new URL("/sources/", url).href);
      await expect(page.getByLabel("Search sources")).toBeVisible();
      await shot(page, version + "-sources-" + size);
      console.log(version, size, "captured");
    }
    await page.close();
    builds.push({ version, ...(await measure(context, url, () => nasa.size)) });
    await context.close();
  }
  const report = {
    browser: browser.version(), cpu: os.cpus()[0]?.model, builds,
    liveNasa: { count: live.length, p50Ms: percentile(live,.5), p95Ms: percentile(live,.95) },
    limitation: "Headless Chromium on the same Windows desktop. Main-page heap excludes worker and GPU. NASA requests are shared between builds. Device emulation does not measure physical phone performance.",
  };
  await writeFile(output + "/performance.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
});

test("captures touch Help at the phone and tablet sizes", async ({ browser }) => {
  await mkdir(output, { recursive: true });
  for (const [width, height] of [[390,844],[375,667],[844,390],[834,1194],[1194,834]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("marspath-onboarded","1"));
    await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:4333");
    await expect(map(page)).toHaveAttribute("data-ready", "true");
    await button(page, /^Help/).tap();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Keyboard shortcuts" })).toBeHidden();
    await dialog.evaluate((node) => Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined))));
    await shot(page, "after-touch-help-" + width + "x" + height);
    await context.close();
  }
});
