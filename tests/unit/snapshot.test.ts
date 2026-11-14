import { expect, it } from "vitest";
import { analyseRoute } from "../../lib/routeAnalysis";
import { geographicRoute, type PlannerResult } from "../../lib/planner";
import { matchingRouteAnalyses } from "../../lib/routeSnapshot";
import climate from "../../public/processed/mcd-v62.json";

it("retains display samples only for identical geometry, connectors and dataset fingerprints", async () => {
  const route = geographicRoute({ start: [77.42, 18.46], end: [77.44, 18.47], waypoints: [] });
  const result: PlannerResult = { routes: [route], tier: "geographic", reason: "", warnings: [], elapsedMs: 0, cacheHits: 0 };
  const analysis = { [route.id]: await analyseRoute(route, climate, null) };
  expect(matchingRouteAnalyses(result, structuredClone(result), analysis)).toEqual(analysis);
  const geometry = structuredClone(result);
  geometry.routes[0].coordinates[0][0] += .00001;
  expect(matchingRouteAnalyses(result, geometry, analysis)).toBeUndefined();
  const connector = structuredClone(result);
  connector.routes[0].connectors.push([[0, 0], [1, 1]]);
  expect(matchingRouteAnalyses(result, connector, analysis)).toBeUndefined();
  const stale = structuredClone(analysis);
  stale[route.id].factors.temperature.checksum = "old dataset";
  expect(matchingRouteAnalyses(result, result, stale)).toBeUndefined();
});
