import { expect, it } from "vitest";
import { geographicRoute, type PlannerResult } from "../../lib/planner";
import { groupRoutes, prepareReveal, revealPrefix } from "../../lib/routePresentation";
import type { LonLat } from "../../lib/mars";

it("reveals the true ordered line across both wrapped worlds", () => {
  const points: LonLat[] = [[178, 0], [179, 0], [-179, 0], [-178, 0]];
  const path = prepareReveal(points);
  expect(revealPrefix(path, 0)).toEqual([]);
  expect(revealPrefix(path, .25).flat().at(-1)![0]).toBeCloseTo(179);
  expect(revealPrefix(path, .75)).toHaveLength(2);
  expect(revealPrefix(path, .75).flat().at(-1)![0]).toBeCloseTo(-179);
  expect(revealPrefix(path, 1)).toEqual([[[178, 0], [179, 0], [180, 0]], [[-180, 0], [-179, 0], [-178, 0]]]);
  expect(points).toEqual([[178, 0], [179, 0], [-179, 0], [-178, 0]]);
});

it("groups exact paths and retains distinct stops and strategy names", () => {
  const base = geographicRoute({ start: [1, 2], end: [3, 4], waypoints: [] });
  const result: PlannerResult = {
    routes: [base, { ...base, id: "duplicate", name: "Duplicate" }, {
      ...base, id: "stop", stops: [[1, 2], [2, 3], [3, 4]],
    }],
    tier: "geographic", reason: "", warnings: [], elapsedMs: 0, cacheHits: 0,
    scores: [.2, .1, .3],
  };
  const aggregated = groupRoutes(result);
  expect(aggregated.routes).toHaveLength(2);
  expect(aggregated.routes[0].strategies?.map(({ id }) => id)).toEqual(["geographic", "duplicate"]);
  expect(aggregated.scores).toEqual([.1, .3]);
});
