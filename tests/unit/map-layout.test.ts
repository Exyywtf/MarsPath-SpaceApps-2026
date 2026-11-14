import { expect, it } from "vitest";
import { deriveMapLayout, intersects } from "../../lib/mapLayout";
import { labelRect, selectMapLabels, type LabelInput, type LabelPlacement } from "../../lib/mapLabels";

it("docks the HUD above an intersecting sheet and exposes Show map when it cannot fit", () => {
  const viewport = { x: 0, y: 0, width: 390, height: 844 };
  const header = { x: 10, y: 10, width: 370, height: 106 }, footer = { x: 0, y: 804, width: 390, height: 40 };
  const half = deriveMapLayout(viewport, header, footer, { x: 8, y: 440, width: 374, height: 358 }, false, 10, 136, 32);
  expect(half.hudBottom).toBe(428);
  expect(half.hudCovered).toBe(false);
  expect(deriveMapLayout(viewport, header, footer, { x: 8, y: 130, width: 374, height: 668 }, false, 10, 136, 32).hudCovered).toBe(true);
  const rail = deriveMapLayout(viewport, header, footer, { x: 8, y: 130, width: 280, height: 668 }, true, 10, 136, 32);
  expect(rail.hudBottom).toBe(792);
});

it("selects deterministic labels with priority, wrapping bounds and UI collision avoidance", () => {
  const labels: LabelInput[] = [
    { id: "selected", x: 200, y: 160, width: 140, height: 40, priority: 0 },
    { id: "jezero", x: 202, y: 162, width: 100, height: 24, priority: 1 },
    { id: "remaining", x: 400, y: 250, width: 150, height: 24, priority: 3 },
  ];
  const layout = { viewport: { x: 0, y: 0, width: 600, height: 400 }, overlays: [{ x: 0, y: 0, width: 130, height: 400 }] };
  const first = selectMapLabels(labels, layout, new Map());
  expect([...selectMapLabels([...labels].reverse(), layout, new Map())]).toEqual([...first]);
  expect(first.has("selected")).toBe(true);
  for (const [id, p] of first) {
    expect(layout.overlays.some((r) => intersects(p.rect, r, 8))).toBe(false);
    for (const [other, q] of first) if (other !== id) expect(intersects(p.rect, q.rect, 8)).toBe(false);
  }
  expect([...selectMapLabels(labels, layout, first)]).toEqual([...first]);
});

it("retains labels with 4 px clearance and reserves fading bounds before admitting new labels", () => {
  const label = { id: "a", x: 50, y: 55, width: 80, height: 24, priority: 0 };
  const placement: LabelPlacement = { position: "above", rect: labelRect(label, "above") };
  const layout = { viewport: { x: 0, y: 0, width: 100, height: 100 }, overlays: [{ x: 0, y: 0, width: 100, height: 12 }] };
  expect(selectMapLabels([label], layout, new Map()).get("a")?.position).not.toBe("above");
  expect(selectMapLabels([label], layout, new Map([["a", placement]])).get("a")?.position).toBe("above");
  const blocked = selectMapLabels([label], layout, new Map(), [{ x: 0, y: 0, width: 100, height: 100 }]);
  expect(blocked.size).toBe(0);
});
