import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

async function exportRoute(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export route & provenance" }).click();
  return JSON.parse(await readFile(await (await pending).path(), "utf8"));
}

test("science evidence is reported after geometry and stays separate from ranking", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (...args: [message: { kind?: string }, transfer?: Transferable[] | StructuredSerializeOptions]) {
      if (args[0]?.kind === "calculate") {
        const root = document.documentElement;
        root.dataset.calculateCount = String(Number(root.dataset.calculateCount ?? "0") + 1);
      }
      return Reflect.apply(original, this, args);
    };
  });
  let release!: () => void;
  const hold = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/science-v1/geology.bin.gz", async (route) => { await hold; await route.continue(); }, { times: 1 });
  await page.goto("/");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await page.getByRole("button", { name: "Try Jezero terrain example" }).click();
  const first = await exportRoute(page);
  const firstProps = first.features[0].properties;
  expect(first.features[0].geometry.coordinates.length).toBeGreaterThan(0);
  expect(firstProps.explorationEvidence.status).toBe("pending");
  expect(firstProps.explorationEvidence.roles).toBeUndefined();
  release();
  const evidence = page.locator(".route-evidence");
  await evidence.getByRole("button", { name: "Geology & surface evidence" }).click();
  await expect(evidence.getByRole("status")).toHaveText(/0% ranking weight/);
  await expect(evidence).toContainText("mapped at 0.125°");
  await expect(evidence).toContainText("Closest CRISM observation centre");
  await expect(evidence).toContainText("Closest Hydrated mineral site");
  const selector = evidence.getByRole("combobox", { name: "Mapped unit to compare" });
  await selector.selectOption("HNt");
  await expect(evidence).toContainText(/mapped/);
  await expect(page.locator(".route-explanation")).toContainText("research comparison with zero score weight");
  const final = await exportRoute(page);
  const finalProps = final.features[0].properties;
  const science = finalProps.explorationEvidence;
  expect(science.status).toBe("ready");
  expect(science.provenance.version).toBe("marspath-route-evidence-v1");
  expect(science.provenance.datasetVersion).toBe("science-v2");
  expect(science.provenance.minerals.hydrated.product).toBe("HYDROUS_SITES_GEO_MAP");
  expect(science.roles.terrain.minerals.hydrated.distanceM).toBeGreaterThanOrEqual(0);
  expect(science.roles.terrain.minerals.hydrated.observation.sourceRows[0]).toBeGreaterThan(0);
  expect(science.mappedUnitComparison).toBe("HNt");
  expect(science.roles.terrain.lengthM).toBeCloseTo(finalProps.assessedDistanceM, 4);
  expect(science.roles.terrain.geology.validLengthM).toBeCloseTo(science.roles.terrain.lengthM, 4);
  expect(science.roles.connector?.lengthM ?? 0).toBeCloseTo(finalProps.distanceM - finalProps.assessedDistanceM, 4);
  expect(science.provenance.rankingWeight).toBe(0);
  expect(final.features[0].geometry).toEqual(first.features[0].geometry);
  if (firstProps.rankingStatus === "ready") expect(firstProps.ranking).toEqual(finalProps.ranking);
  await testInfo.attach("route-evidence", { body: JSON.stringify(final), contentType: "application/geo+json" });

  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.getByRole("button", { name: /^Global geology/ }).click();
  await expect(page.locator("#interactive-mars-map")).toHaveAttribute("data-overlay", "geology");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.getByLabel("Search scientific destinations").fill("Mawrth");
  await page.locator(".destination").click();
  await page.getByRole("button", { name: "Next image" }).click();
  await expect(page.locator(".destination-gallery")).toHaveAttribute("data-slide", "2");
  await expect(page.locator("html")).toHaveAttribute("data-calculate-count", "1");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await expect(selector).toHaveValue("HNt");
  expect((await exportRoute(page)).features[0].geometry).toEqual(final.features[0].geometry);
});

test("a superseded evidence message cannot complete a newer export", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(Worker.prototype, "onmessage")!;
    const held = new Map<number, () => void>();
    Object.defineProperty(Worker.prototype, "onmessage", { ...descriptor, set(listener: (event: MessageEvent) => void) {
      descriptor.set!.call(this, (event: MessageEvent) => {
        if (event.data.kind !== "evidence") { listener.call(this, event); return; }
        held.set(event.data.id, () => listener.call(this, event));
        document.documentElement.dataset.heldEvidence = String(event.data.id);
      });
    } });
    window.addEventListener("release-evidence", (event) => held.get((event as CustomEvent<number>).detail)?.());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await page.getByRole("button", { name: "Try Jezero terrain example" }).click();
  const held = async () => Number(await page.locator("html").getAttribute("data-held-evidence"));
  await expect.poll(held).toBeGreaterThan(0);
  const first = await held();
  await page.getByRole("button", { name: "Recalculate", exact: true }).evaluate((button: HTMLButtonElement) => button.click());
  await expect.poll(held).toBeGreaterThan(first);
  await page.evaluate((id) => dispatchEvent(new CustomEvent("release-evidence", { detail: id })), first);
  expect((await exportRoute(page)).features[0].properties.explorationEvidence.status).toBe("pending");
  await page.evaluate((id) => dispatchEvent(new CustomEvent("release-evidence", { detail: id })), await held());
  expect((await exportRoute(page)).features[0].properties.explorationEvidence.status).toBe("ready");
});
