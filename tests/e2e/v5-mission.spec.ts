import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("Jezero mission shares the draft, plans its return and compares a fixed candidate pool", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message, ...args) {
      if (message?.kind === "calculate") document.documentElement.dataset.searches =
        String(1 + Number(document.documentElement.dataset.searches || 0));
      return Reflect.apply(post, this, [message, ...args]);
    };
  });
  await page.goto("/?mission=jezero");
  await expect(page.getByRole("heading", { name: "Mission Planner" })).toBeVisible();
  await expect(page.getByLabel("Speed (km/h)", { exact: true })).toHaveValue("");
  await expect(page.getByText("Choose a start", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try validated mission example" }).click();
  await expect(page.getByRole("heading", { name: "Compare routes" })).toBeVisible();
  const journey = page.getByRole("region", { name: "Mission journey" });
  await expect(journey).toContainText("Outbound · A to B");
  await expect(journey).toContainText("Return · B to A");
  await expect(journey).toContainText("Estimated round-trip duration");
  await page.getByRole("button", { name: "What changes this recommendation?" }).click();
  await page.getByRole("button", { name: "Science first", exact: true }).click();
  await expect(page.locator(".route-option.selected")).toContainText("Science-aware route");
  await page.getByRole("button", { name: "Shortest", exact: true }).click();
  await expect(page.locator(".route-option.selected")).toContainText("Shortest feasible");
  await expect(page.locator("html")).toHaveAttribute("data-searches", "1");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Compare routes" })).toBeVisible();
  await page.getByRole("button", { name: "Mission Planner", exact: true }).click();
  await expect(page.getByLabel("Speed (km/h)", { exact: true })).toHaveValue("2");
  await expect(journey).toContainText("Return · B to A");
  await expect(page.locator("html")).toHaveAttribute("data-searches", "1");
});

test("terrain coverage inspection and shared Help work from the static pages", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?place=jezero");
  const map = page.locator('#interactive-mars-map[data-ready="true"][data-animating="false"]');
  await expect(map).toBeVisible();
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.getByLabel(/Scientific destinations/).uncheck();
  await page.getByRole("button", { name: /^Data Quality & Coverage/ }).click();
  await expect(map).toHaveAttribute("data-overlay", "coverage");
  await expect(page.getByRole("list", { name: "Terrain coverage legend" }).last()).toContainText("Coarse MOLA terrain");
  const box = (await map.boundingBox())!;
  const [lon, lat] = JSON.parse((await map.getAttribute("data-center"))!);
  const scale = Number(await map.getAttribute("data-resolution"));
  await map.click({ position: { x: box.width / 2 + (77.5 - lon) / scale, y: box.height / 2 - (18.4 - lat) / scale } });
  await expect(page.getByRole("complementary", { name: "Scientific value inspection" })).toContainText("Regional terrain");
  await page.goto("/sources/");
  await page.setViewportSize({ width: 320, height: 568 });
  const help = page.getByRole("link", { name: "Help and keyboard shortcuts" });
  expect((await help.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await help.click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("mission daylight and visibility export with both legs and a printable brief", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?mission=jezero");
  await page.getByRole("button", { name: "Try validated mission example" }).click();
  await expect(page.getByText("Return · B to A", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Daylight & departure" }).click();
  await expect(page.getByLabel("Inspect daylight on map")).toBeVisible();
  await expect(page.locator(".mission-daylight")).toContainText("2026-11-15T15:00:00.000Z");
  await page.getByLabel("Show solar terminator").check();
  await page.getByRole("button", { name: "Communications assumptions" }).click();
  await page.getByRole("button", { name: "Use A as station" }).click();
  await page.getByLabel("Station antenna height (m)").fill("3");
  await page.getByLabel("Observer antenna height (m)").fill("2");
  await page.getByRole("button", { name: "Terrain line of sight" }).click();
  await expect(page.getByLabel("Show visibility samples on map")).toBeVisible();
  await expect(page.locator(".mission-visibility .visibility-leg")).toHaveCount(2);
  const file = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export mission GeoJSON" }).click();
  const exported = JSON.parse(await readFile(await (await file).path(), "utf8"));
  expect(exported.mission.version).toBe("marspath-mission-v1");
  expect(exported.mission.missionConditions.daylight.timeline.daylightSeconds).toBeGreaterThan(0);
  expect(exported.mission.returnStatus).toBe("ready");
  const roles = new Set(exported.features.map((feature: { properties: { leg: string } }) => feature.properties.leg));
  expect([...roles]).toEqual(["outbound", "return"]);
  const newTab = context.waitForEvent("page");
  await page.getByRole("button", { name: "Generate Mission Brief" }).click();
  const brief = await newTab;
  await expect(brief.getByRole("heading", { name: "Jezero delta investigation" })).toBeVisible();
  await expect(brief.getByRole("button", { name: "Print / Save as PDF" })).toBeVisible();
  await expect(brief.getByRole("heading", { name: "Sources and reproducibility" })).toBeVisible();
  await expect(brief.getByText(/Return line of sight/)).toBeVisible();
  await brief.emulateMedia({ media: "print" });
  await expect(brief.getByRole("button", { name: "Print / Save as PDF" })).toBeHidden();
});

test("pending mission exports and superseded conditions preserve the current departure and removal state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const property = Object.getOwnPropertyDescriptor(Worker.prototype, "onmessage")!;
    const held: (() => void)[] = [];
    (window as typeof window & { releaseMissionReplies: () => void }).releaseMissionReplies = () => {
      for (const deliver of held.splice(0)) deliver();
    };
    Object.defineProperty(Worker.prototype, "onmessage", { ...property, set(listener: (event: MessageEvent) => void) {
      property.set!.call(this, (event: MessageEvent) => {
        if (event.data.kind === "mission-context" && document.documentElement.dataset.holdMission === "yes") {
          held.push(() => listener.call(this, event));
          document.documentElement.dataset.heldMissions = String(held.length);
        } else listener.call(this, event);
      });
    } });
  });
  await page.goto("/?mission=jezero");
  await page.evaluate(() => { document.documentElement.dataset.holdMission = "yes"; });
  await page.getByRole("button", { name: "Try validated mission example" }).click();
  await expect(page.getByText("Return · B to A", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-held-missions", /[1-9]/);
  const file = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export mission GeoJSON" }).click();
  const exported = JSON.parse(await readFile(await (await file).path(), "utf8"));
  expect(exported.mission.contextStatus).toBe("pending");
  expect(exported.mission.missionConditions).toBeUndefined();
  await page.evaluate(() => { delete document.documentElement.dataset.holdMission; });
  await page.getByLabel("Departure (Earth UTC)").fill("2026-11-15T18:00");
  await page.getByRole("button", { name: "Daylight & departure" }).click();
  await expect(page.locator(".mission-daylight")).toContainText("2026-11-15T18:00:00.000Z");
  const release = () => (window as typeof window & { releaseMissionReplies: () => void }).releaseMissionReplies();
  await page.evaluate(release);
  await expect(page.locator(".mission-daylight")).not.toContainText("2026-11-15T15:00:00.000Z");
  await page.evaluate(() => { document.documentElement.dataset.holdMission = "yes"; delete document.documentElement.dataset.heldMissions; });
  await page.getByLabel("Departure (Earth UTC)").fill("2026-11-15T19:00");
  await expect(page.locator("html")).toHaveAttribute("data-held-missions", /[1-9]/);
  await page.getByRole("button", { name: "Edit route", exact: true }).click();
  await page.getByRole("button", { name: "Remove point A", exact: true }).click();
  await page.evaluate(release);
  await expect(page.locator(".route-option")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export mission GeoJSON" })).toHaveCount(0);
});
