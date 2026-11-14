import { marsDistance, type LonLat } from "./mars";
import { splitDateLine, type PlannerResult, type PlannedRoute } from "./planner";

function samePoints(a: LonLat[], b: LonLat[]) {
  return a.length === b.length && a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1]);
}

export function groupRoutes(result: PlannerResult): PlannerResult {
  const routes: PlannedRoute[] = [], scores: number[] = [];
  for (const [index, route] of result.routes.entries()) {
    const match = routes.findIndex((other) =>
      other.tier === route.tier &&
      samePoints(other.stops ?? [], route.stops ?? []) &&
      (other.terrain && route.terrain
        ? other.terrain.cells.length === route.terrain.cells.length &&
          other.terrain.cells.every((cell, i) => cell === route.terrain!.cells[i])
        : samePoints(other.coordinates, route.coordinates)) &&
      other.connectors.length === route.connectors.length &&
      other.connectors.every((c, i) => samePoints(c, route.connectors[i])),
    );
    const strategy = { id: route.id, name: route.name, lambda: route.terrain?.lambda };
    const score = result.scores?.[index] ?? 0;
    if (match < 0) {
      routes.push({ ...route, strategies: [strategy] });
      scores.push(score);
    } else {
      const other = routes[match];
      other.strategies!.push(strategy);
      if (score < scores[match]) scores[match] = score;
      if (route.scienceStops?.length && !other.scienceStops?.length)
        routes[match] = { ...other, scienceStops: route.scienceStops, note: route.note };
    }
  }
  return { ...result, routes, scores: result.scores ? scores : undefined };
}

// Seam vertices share a position on Mars. Retain separate display parts so
// the drawing head never sweeps across the map when it reaches that seam.
export function prepareReveal(coordinates: LonLat[]) {
  let length = 0, previous: LonLat | undefined;
  const parts = splitDateLine(coordinates).map((points) => ({
    points,
    distances: points.map((point, i) => {
      if (i && previous) length += marsDistance(previous, point);
      previous = point;
      return length;
    }),
  }));
  const full = parts.map(({ points }) => points);
  return { length, full, parts };
}

export function revealPrefix(route: ReturnType<typeof prepareReveal>, progress: number) {
  if (progress >= 1) return route.full;
  if (progress <= 0) return [];
  const limit = progress * route.length, result: LonLat[][] = [];
  for (const { points, distances } of route.parts) {
    if (distances.at(-1)! <= limit) {
      result.push(points);
      continue;
    }
    if (limit <= distances[0]) break;
    let lo = 0, hi = points.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1;
      if (distances[mid] <= limit) lo = mid;
      else hi = mid;
    }
    const a = points[lo], b = points[hi];
    const t = (limit - distances[lo]) / (distances[hi] - distances[lo]);
    result.push([...points.slice(0, hi), [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]]);
    break;
  }
  return result;
}
