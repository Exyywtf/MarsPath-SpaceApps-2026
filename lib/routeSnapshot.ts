import type { PlannerResult, PlannedRoute } from "./planner";
import type { RouteAnalysis } from "./routeAnalysis";
import { climateSnapshot } from "./layers";
import { radiationManifest } from "./radiation";
import { evidenceProvenance, type RouteEvidence } from "./routeEvidence";

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
  return matchingPaths(previous, next, analyses, (analysis) =>
    Object.entries(analysis.factors).every(([id, factor]) =>
      factor.checksum === (id === "radiation" ? radiationManifest.archiveSha256 : climateSnapshot.sha256)));
}

export function matchingRouteEvidence(
  previous: PlannerResult | undefined, next: PlannerResult, evidence: Record<string, RouteEvidence> | undefined,
) {
  return matchingPaths(previous, next, evidence, ({ provenance }) =>
    provenance.version === evidenceProvenance.version &&
    provenance.datasetVersion === evidenceProvenance.datasetVersion &&
    provenance.geology.checksum === evidenceProvenance.geology.checksum &&
    provenance.thermal.checksum === evidenceProvenance.thermal.checksum &&
    provenance.minerals.checksum === evidenceProvenance.minerals.checksum &&
    provenance.minerals.hydrated?.checksum === evidenceProvenance.minerals.hydrated.checksum);
}

function matchingPaths<T>(
  previous: PlannerResult | undefined, next: PlannerResult, data: Record<string, T> | undefined, isCurrent: (item: T) => boolean,
) {
  if (!previous || !data ||
    previous.meta?.id !== next.meta?.id ||
    previous.meta?.sha256 !== next.meta?.sha256 ||
    previous.meta?.derivedSha256 !== next.meta?.derivedSha256) return undefined;
  const matches: Record<string, T> = {};
  for (const route of next.routes) {
    const old = previous.routes.find((item) => item.id === route.id);
    const item = data[route.id];
    if (old && item && samePath(old, route) && isCurrent(item)) matches[route.id] = item;
  }
  return Object.keys(matches).length ? matches : undefined;
}
