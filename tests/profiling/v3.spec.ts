import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";

const sizes = [[1920,1080],[1440,900],[1024,768],[390,844]];
const output = "tmp/v3-review";
type FrameRecord = { active: boolean; times: number[]; tasks: number[] };
declare global { interface Window { v3frames: FrameRecord } }

async function monitor(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("marspath-onboarded","1");
    sessionStorage.removeItem("marspath-draft-v2");
    window.v3frames = { active:false, times:[], tasks:[] };
    const tick = (now: number) => {
      if (window.v3frames.active) window.v3frames.times.push(now);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    new PerformanceObserver((list) => {
      if (window.v3frames.active)
        for (const entry of list.getEntries()) window.v3frames.tasks.push(entry.duration);
    }).observe({type:"longtask"});
  });
}

const percentile = (values: number[], p: number) =>
  values.slice().sort((a,b) => a-b)[Math.max(0, Math.ceil(values.length*p)-1)] ?? 0;

test("compares V2 and V3 map interactions and captures the route reveal", async ({ browser }) => {
  mkdirSync(output,{recursive:true});
  const cached = new Map<string,{status:number;headers:Record<string,string>;body:Buffer}>();
  const live: number[] = [];
  const nasaOrigin = process.env.NASA_ORIGIN ?? "https://trek.nasa.gov";
  const report = [];
  for (const [version,url] of [
    ["V2",process.env.V2_BASE_URL ?? "http://127.0.0.1:4321"],
    ["V3",process.env.BASE_URL ?? "http://127.0.0.1:4320"],
  ]) {
    const context = await browser.newContext();
    console.log("Profiling",version,url);
    await context.route(nasaOrigin+"/tiles/**",async (route) => {
      const url = route.request().url(), existing = cached.get(url);
      if (existing) { await route.fulfill(existing); return; }
      const started = Date.now();
      try {
        const response = await route.fetch({timeout:5000});
        const entry = {status:response.status(), headers:response.headers(), body:await response.body()};
        if (response.ok()) { cached.set(url,entry); live.push(Date.now()-started); }
        await route.fulfill(entry);
      } catch { await route.abort(); }
    });
    const page = await context.newPage();
    await monitor(page);
    for (const [width,height] of sizes) {
      await page.setViewportSize({width,height});
      await page.goto(url,{waitUntil:"domcontentloaded",timeout:12000});
      const map = page.getByRole("region",{name:"Interactive Mars map"});
      await expect(map).toHaveAttribute("data-animating","false");
      await page.waitForLoadState("networkidle",{timeout:8000}).catch(() => {});
      await page.screenshot({path:output+"/"+version.toLowerCase()+"-explore-"+width+"x"+height+".png"});
      await page.getByRole("button",{name:"Directions",exact:true}).click();
      await page.getByRole("button",{name:"Try Jezero terrain example"}).click();
      await expect(page.locator(".route-option").first()).toHaveCount(1, { timeout: 12000 });
      if (version==="V3") await expect(map).toHaveAttribute("data-reveal","complete");
      await page.screenshot({path:output+"/"+version.toLowerCase()+"-route-"+width+"x"+height+".png"});
      console.log(version,width+"×"+height,"captured");
    }
    await page.setViewportSize({width:1440,height:900});
    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(({name,value}) => [name,value]));
    const map = page.getByRole("region",{name:"Interactive Mars map"});
    const recalc = page.getByRole("button",{name:"Recalculate",exact:true});
    // Warm the exact camera/terrain path before taking the three measurements.
    await recalc.click();
    await expect(page.locator(".route-option").first()).toBeVisible();
    if (version==="V3") await expect(map).toHaveAttribute("data-reveal","complete");
    const trials = [];
    for (let run=0; run<3; run++) {
      await recalc.scrollIntoViewIfNeeded();
      const before = await metrics(), requests = live.length;
      await page.evaluate(() => { window.v3frames = {active:true,times:[],tasks:[]}; });
      const start = Date.now();
      await recalc.click();
      await expect(page.locator(".route-option").first()).toBeVisible();
      const latency = Date.now()-start;
      for (let i=0; i<54; i++) {
        await page.mouse.move(890+Math.sin(i/11)*100,305+Math.cos(i/15)*52);
        await page.waitForTimeout(16);
      }
      if (version==="V3") await expect(map).toHaveAttribute("data-reveal","complete");
      const frames = await page.evaluate(() => { window.v3frames.active=false; return window.v3frames; });
      const after = await metrics(), deltas = frames.times.slice(1).map((t,i) => t-frames.times[i]);
      trials.push({
        resultsMs:latency, p95FrameMs:percentile(deltas,.95), frames:deltas.length,
        longTasks:frames.tasks.length, longestTaskMs:Math.max(0,...frames.tasks),
        mainScriptMs:(after.ScriptDuration-before.ScriptDuration)*1000,
        heapBytes:after.JSHeapUsedSize, networkMisses:live.length-requests,
      });
    }
    await page.getByText("Data quality & coverage",{exact:true}).click();
    const worker = await page.locator(".quality-details dd").filter({hasText:"cached legs"}).last().textContent();
    if (version==="V3") {
      await recalc.click();
      const snapshots = await page.evaluate(async () => {
        const map = document.getElementById("interactive-mars-map")!;
        const frames: {t:number; progress:number}[] = [];
        let observed = false;
        await new Promise<void>((resolve) => {
          const start = performance.now();
          const tick = (now: number) => {
            if (map.dataset.reveal==="drawing") {
              observed = true;
              frames.push({t:now-start,progress:Number(map.dataset.revealProgress)});
            }
            if (observed && map.dataset.reveal==="complete" || now-start>4500) resolve();
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        return frames;
      });
      expect(snapshots.length).toBeGreaterThan(20);
      expect(snapshots.every((frame,i) => i===0 || frame.progress>=snapshots[i-1].progress)).toBe(true);
      writeFileSync(output+"/reveal-frames.json",JSON.stringify(snapshots,null,2));
      for (const threshold of [0,.25,.5,.75,1]) {
        await recalc.click();
        await expect(map).toHaveAttribute("data-reveal","drawing");
        if (threshold) await expect.poll(async () => Number(await map.getAttribute("data-reveal-progress")),{intervals:[20]}).toBeGreaterThanOrEqual(threshold);
        await page.screenshot({path:output+"/reveal-"+threshold+".png"});
        await expect(map).toHaveAttribute("data-reveal","complete");
      }
      const [download] = await Promise.all([
        page.waitForEvent("download"), page.getByRole("button",{name:"Export route & provenance"}).click(),
      ]);
      await download.saveAs(output+"/jezero-validated.geojson");
    }
    report.push({version,trials,terrainWorkerLast:worker});
    await context.close();
  }
  const data = {
    browser:browser.version(), cpu:os.cpus()[0]?.model,
    timeframe:"Three fixed 1440 × 900 Chromium trials after warming the view. Each recalculates the Jezero example, then executes 54 pointer moves over the map.",
    limitation:"Browser main JS heap excludes worker memory and GPU. Headless desktop figures do not measure mobile hardware.",
    cachedTiles:cached.size, separateLiveNasaMs:{samples:live.length,median:percentile(live,.5),p95:percentile(live,.95)},
    builds:report,
  };
  writeFileSync(output+"/performance.json",JSON.stringify(data,null,2));
  console.log(JSON.stringify(data));
});
