import { MARS_RADIUS, marsDistance, type LonLat } from "./mars";
import type { PlannedRoute } from "./planner";
import { orderedSpans, sphericalArc, sphericalVector, type SphericalVector } from "./routeAnalysis";
import { terrainProjected, type Terrain } from "./routing";

export const visibilityMethod = "Mars spherical chord with bilinear terrain sampling at half-cell spacing. Geometric clearance only.";
export type Visibility = "clear" | "obstructed" | "unknown";
export type VisibilitySample = { point: LonLat; distanceM: number; status: Visibility; clearanceM?: number };

export function sampleTerrainElevation(terrain: Terrain, point: LonLat) {
  const { meta, elevation, valid } = terrain;
  const [a, , x0, , b, y0] = meta.transform;
  const [x, y] = terrainProjected(meta, point);
  const column = (x - x0) / a - 0.5, row = (y - y0) / b - 0.5;
  const c = Math.floor(column), r = Math.floor(row);
  const u = column - c, v = row - r;
  let height = 0;
  for (const [dx, dy, weight] of [[0, 0, (1-u)*(1-v)], [1, 0, u*(1-v)], [0, 1, (1-u)*v], [1, 1, u*v]]) {
    if (weight < 1e-12) continue;
    const px = c + dx, py = r + dy, index = py * meta.width + px;
    if (px < 0 || py < 0 || px >= meta.width || py >= meta.height || valid[index] !== 1 || !Number.isFinite(elevation[index])) return null;
    height += elevation[index] * weight;
  }
  return height;
}

function antenna(terrain: Terrain, point: LonLat, height: number) {
  const elevation = sampleTerrainElevation(terrain, point);
  if (elevation === null || !Number.isFinite(height) || height < 0) return null;
  return sphericalVector(point).map((component) => component * (MARS_RADIUS + elevation + height)) as SphericalVector;
}

export function terrainRay(terrain: Terrain, station: SphericalVector | null, point: LonLat, height: number) {
  const observer = antenna(terrain, point, height);
  if (!station || !observer) return { status: "unknown" as const };
  const delta = observer.map((component, i) => component - station[i]) as SphericalVector;
  const steps = Math.max(2, Math.ceil(Math.hypot(...delta) / (terrain.meta.pixelSize / 2)));
  if (!Number.isFinite(steps) || steps > 8192) return { status: "unknown" as const };
  let minimum = Infinity;
  for (let i = 1; i < steps; i++) {
    const fraction = i / steps;
    const x = station[0] + delta[0] * fraction;
    const y = station[1] + delta[1] * fraction;
    const z = station[2] + delta[2] * fraction;
    const surface = sampleTerrainElevation(terrain, [
      Math.atan2(y, x) * 180 / Math.PI, Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI,
    ]);
    if (surface === null) return { status: "unknown" as const };
    minimum = Math.min(minimum, Math.hypot(x, y, z) - MARS_RADIUS - surface);
  }
  return { status: minimum > 1e-6 ? "clear" as const : "obstructed" as const, clearanceM: minimum };
}

export function testTerrainRay(terrain: Terrain, station: LonLat, fromHeight: number, observer: LonLat, toHeight: number) {
  return terrainRay(terrain, antenna(terrain, station, fromHeight), observer, toHeight);
}

export async function routeVisibility(
  terrain: Terrain, route: PlannedRoute, stationPoint: LonLat, stationHeight: number, observerHeight: number,
  cancelled: () => boolean,
) {
  const spans = [...orderedSpans(route)].flatMap(({ a, b, role }) => {
    const arc = sphericalArc(a, b);
    return arc ? [{ arc, role, length: marsDistance(a, b) }] : [];
  });
  const distance = spans.reduce((sum, span) => sum + span.length, 0);
  const intervals = Math.min(511, Math.max(1, Math.ceil(distance / 40)));
  const origin = antenna(terrain, stationPoint, stationHeight);
  const samples: VisibilitySample[] = [];
  const pointOnRoute = (span: typeof spans[number], along: number, travelled: number) =>
    span.arc.lonLat(span.arc.theta * Math.min(1, Math.max(0, (along - travelled) / span.length)));
  let index = 0, travelled = 0;
  for (let i = 0; i <= intervals && spans.length; i++) {
    const along = i / intervals * distance;
    while (index < spans.length - 1 && along > travelled + spans[index].length) travelled += spans[index++].length;
    const { role } = spans[index];
    const point = pointOnRoute(spans[index], along, travelled);
    const outcome = role === "terrain" ? terrainRay(terrain, origin, point, observerHeight) : { status: "unknown" as const };
    samples.push({ ...outcome, point, distanceM: along });
    if (i % 8 === 7) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (cancelled()) throw new Error("Visibility calculation was superseded.");
    }
  }
  return {
    source: terrain.meta.sourcePage, dataset: terrain.meta.id, checksum: terrain.meta.derivedSha256 ?? terrain.meta.sha256,
    station: stationPoint, resolutionM: terrain.meta.pixelSize, rayStepM: terrain.meta.pixelSize / 2,
    spacingM: distance / intervals, samples,
  };
}
