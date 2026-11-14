import { expect, it } from "vitest";
import { analyseEvidence, arcDistance } from "../../lib/routeEvidence";
import { marsDistance } from "../../lib/mars";
import { sphericalArc, sphericalVector } from "../../lib/routeAnalysis";
import type { PlannedRoute } from "../../lib/planner";

it("measures closest catalogue approaches on the full spherical arc across the seam", () => {
  const arc = sphericalArc([179, 0], [-179, 0])!;
  expect(arcDistance(sphericalVector([180, 1]), arc)).toBeCloseTo(marsDistance([180, 0], [180, 1]), 5);
  expect(arcDistance(sphericalVector([-178, 0]), arc)).toBeCloseTo(marsDistance([-179, 0], [-178, 0]), 5);
});

it("splits categorical and masked numerical lengths at grid edges and exports connectors separately", async () => {
  const route: PlannedRoute = {
    id: "seam", tier: "coarse", name: "Seam fixture", assessedDistance: 0, distance: 0,
    coordinates: [[179.9375, 0], [-179.8125, 0]],
    connectors: [[[179.9, 0], [179.9375, 0]], [[-179.8125, 0], [-179.8125, 0]]],
    stopIndices: [0, 1], reached: [], snapping: [],
  };
  const width = 2880, height = 1440;
  const cells = new Uint16Array(width * height);
  for (const row of [719, 720]) {
    cells[row * width + width - 1] = 1;
    cells[row * width] = 2;
    cells[row * width + 1] = 1;
  }
  const t = new Uint16Array(1440 * 720);
  t[360 * 1440] = 400;
  const result = await analyseEvidence(route, {
    geology: { width, height, cells, catalog: { "1": "A", "2": "B" } },
    thermal: { width: 1440, height: 720, cells: t },
    minerals: [{ kind: "chloride", id: "test", label: "Published centre fixture", point: [179.9, 0] }],
  }, () => false);
  const terrain = result.roles.terrain!, connector = result.roles.connector!;
  expect(terrain.lengthM).toBeCloseTo(marsDistance(route.coordinates[0], route.coordinates[1]), 6);
  expect(terrain.geology?.unitLengthM.A).toBeCloseTo(terrain.lengthM / 2, 6);
  expect(terrain.geology?.unitLengthM.B).toBeCloseTo(terrain.lengthM / 2, 6);
  expect(terrain.geology?.changes.map(({ from, to }) => [from, to])).toEqual([["A", "B"], ["B", "A"]]);
  expect(terrain.thermal?.validLengthM).toBeCloseTo(terrain.lengthM * .75, 6);
  expect(terrain.thermal?.mean).toBeCloseTo(400, 8);
  expect(terrain.minerals?.chloride?.distanceM).toBeGreaterThan(2000);
  expect(connector.minerals?.chloride?.distanceM).toBeLessThan(.000001);
  expect(connector.thermal?.mean).toBeNull();
  expect(result.provenance.rankingWeight).toBe(0);
});

it("keeps geographic evidence and missing products identifiable and honours cancellation", async () => {
  const route: PlannedRoute = {
    id: "polar", tier: "geographic", name: "Polar fixture", coordinates: [[0, 89.8], [180, 89.6]],
    distance: 0, assessedDistance: 0, connectors: [], reached: [], snapping: [],
  };
  const inputs = { geology: null, thermal: null, minerals: null };
  const result = await analyseEvidence(route, inputs, () => false);
  expect(result.roles.geographic?.lengthM).toBeCloseTo(marsDistance(route.coordinates[0], route.coordinates[1]), 6);
  expect(result.roles.geographic?.geology).toBeUndefined();
  expect(result.roles.terrain).toBeUndefined();
  await expect(analyseEvidence(route, inputs, () => true)).rejects.toThrow("superseded");
});
