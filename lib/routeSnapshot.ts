import type { PlannerResult, PlannedRoute } from "./planner";
import type { RouteAnalysis } from "./routeAnalysis";
import { climateSnapshot } from "./layers";
import { radiationManifest } from "./radiation";

function samePoints(a: number[][], b: number[][]) {
  return a.length === b.length && a.every((point, i) => point[0] === b[i][0] && point[1] === b[i][1]);
}

function samePath(a: PlannedRoute, b: PlannedRoute) {
  return a.tier === b.tier && a.distance === b.distance && a.assessedDistance === b.assessedDistance &&
    samePoints(a.coordinates, b.coordinates) && a.connectors.length === b.connectors.length &&
    a.connectors.every((span, i) => samePoints(span, b.connectors[i])) &&
    (a.stopIndices ?? []).join(",") === (b.stopIndices ?? []).join(",");
}

export function matchingRouteAnalyses(
  previous: PlannerResult | undefined,
  next: PlannerResult,
  analyses: Record<string, RouteAnalysis> | undefined,
) {
  if (!previous || !analyses ||
    previous.meta?.id !== next.meta?.id ||
    previous.meta?.sha256 !== next.meta?.sha256 ||
    previous.meta?.derivedSha256 !== next.meta?.derivedSha256) return undefined;
  const matches: Record<string, RouteAnalysis> = {};
  for (const route of next.routes) {
    const old = previous.routes.find((item) => item.id === route.id);
    const analysis = analyses[route.id];
    if (!old || !analysis || !samePath(old, route)) continue;
    const valid = Object.entries(analysis.factors).every(([id, factor]) =>
      factor.checksum === (id === "radiation" ? radiationManifest.archiveSha256 : climateSnapshot.sha256));
    if (valid) matches[route.id] = analysis;
  }
  return Object.keys(matches).length ? matches : undefined;
}
