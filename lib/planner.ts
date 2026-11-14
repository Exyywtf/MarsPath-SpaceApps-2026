import {
  marsDistance,
  MARS_RADIUS,
  normalizeLon,
  radians,
  type LonLat,
} from "./mars";
import type { RouteResult, TerrainMeta } from "./routing";
export type Placement = "start" | "end" | "waypoint" | null;
export type RoutingTier = "regional" | "coarse" | "geographic";
export interface PlannerDraft {
  start: LonLat | null;
  end: LonLat | null;
  waypoints: LonLat[];
}
export interface PlannerSettings {
  maxSlope: number;
  riskWeight: number;
  objectives: string[];
  distanceWeight: number;
  terrainWeight: number;
  scienceWeight: number;
  geographicOnly: boolean;
}
export const defaultSettings: PlannerSettings = {
  maxSlope: 20,
  riskWeight: 4,
  objectives: [],
  distanceWeight: 35,
  terrainWeight: 45,
  scienceWeight: 20,
  geographicOnly: false,
};
export interface PlannedRoute {
  id: string;
  name: string;
  tier: RoutingTier;
  coordinates: LonLat[];
  distance: number;
  terrain?: RouteResult;
  connectors: LonLat[][];
  assessedDistance: number;
  reached: string[];
  snapping: number[];
  note?: string;
  scienceStops?: string[];
  stops?: LonLat[];
  quality?: {
    validPathCells: number;
    pathCells: number;
    gridValidCells: number;
    gridTotalCells: number;
  };
}
export interface PlannerRequest {
  id: number;
  draft: PlannerDraft;
  settings: PlannerSettings;
}
export interface PlannerResult {
  routes: PlannedRoute[];
  tier: RoutingTier;
  reason: string;
  meta?: TerrainMeta;
  elapsedMs: number;
  cacheHits: number;
  warnings: string[];
  scores?: number[];
  evaluatedCandidates?: number;
  scienceAttempts?: number;
}
export const emptyDraft: PlannerDraft = {
  start: null,
  end: null,
  waypoints: [],
};
export function parseCoordinate(latitude: string, longitude: string): LonLat {
  if (!latitude.trim() || !longitude.trim())
    throw new Error("Enter both latitude and east longitude.");
  const lat = Number(latitude),
    lon = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90)
    throw new Error("Latitude must be between −90° and 90°.");
  if (!Number.isFinite(lon) || lon < -180 || lon > 360)
    throw new Error("East longitude must be between −180° and 360°.");
  return [normalizeLon(lon), lat];
}
export function within(meta: TerrainMeta, p: LonLat) {
  return (
    p[0] >= meta.bounds[0] &&
    p[0] < meta.bounds[2] &&
    p[1] > meta.bounds[1] &&
    p[1] <= meta.bounds[3]
  );
}
export function draftPoints(draft: PlannerDraft): LonLat[] {
  return draft.start && draft.end
    ? [draft.start, ...draft.waypoints, draft.end]
    : [];
}
export function greatCircle(a: LonLat, b: LonLat): LonLat[] {
  const vector = ([lon, lat]: LonLat) => [
    Math.cos(radians(lat)) * Math.cos(radians(lon)),
    Math.cos(radians(lat)) * Math.sin(radians(lon)),
    Math.sin(radians(lat)),
  ];
  const u = vector(a),
    v = vector(b),
    angle = Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          u.reduce((s, n, i) => s + n * v[i], 0),
        ),
      ),
    );
  if (angle < 1e-10) return [a, b];
  let tangent = v.map((n, i) => n - u[i] * Math.cos(angle));
  let length = Math.hypot(...tangent);
  if (length < 1e-10) {
    const axis = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
    const dot = u.reduce((s, n, i) => s + n * axis[i], 0);
    tangent = axis.map((n, i) => n - dot * u[i]);
    length = Math.hypot(...tangent);
  }
  tangent = tangent.map((n) => n / length);
  const count = Math.max(2, Math.ceil((angle * 180) / Math.PI));
  const points: LonLat[] = [];
  for (let i = 0; i <= count; i++) {
    const t = (angle * i) / count;
    const p = u.map((n, j) => n * Math.cos(t) + tangent[j] * Math.sin(t));
    points.push([
      normalizeLon((Math.atan2(p[1], p[0]) * 180) / Math.PI),
      (Math.atan2(p[2], Math.hypot(p[0], p[1])) * 180) / Math.PI,
    ]);
  }
  points[0] = a;
  points[points.length - 1] = b;
  return points;
}
export function geographicRoute(draft: PlannerDraft): PlannedRoute {
  const points = draftPoints(draft);
  let distance = 0;
  const coordinates: LonLat[] = [];
  for (let i = 1; i < points.length; i++) {
    distance += marsDistance(points[i - 1], points[i]);
    coordinates.push(
      ...greatCircle(points[i - 1], points[i]).slice(i === 1 ? 0 : 1),
    );
  }
  return {
    id: "geographic",
    name: "Geographic connection",
    tier: "geographic",
    coordinates,
    distance,
    assessedDistance: 0,
    connectors: [],
    reached: [],
    snapping: [],
  };
}
export function splitDateLine(points: LonLat[]): LonLat[][] {
  if (!points.length) return [];
  const parts: LonLat[][] = [[points[0]]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (Math.abs(b[0] - a[0]) > 180) {
      const eastbound = b[0] < a[0],
        edge = eastbound ? 180 : -180;
      const unwrapped = b[0] + (eastbound ? 360 : -360);
      const fraction =
        unwrapped === a[0] ? 0 : (edge - a[0]) / (unwrapped - a[0]);
      const lat = a[1] + (b[1] - a[1]) * fraction;
      parts.at(-1)!.push([edge, lat]);
      parts.push([[-edge, lat]]);
    }
    parts.at(-1)!.push(b);
  }
  return parts;
}
export function unwrapRoute(points: LonLat[]): LonLat[] {
  if (!points.length) return [];
  const unwrapped = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [lon, lat] = points[i];
    const previous = unwrapped[i - 1][0];
    unwrapped.push([previous + normalizeLon(lon - previous), lat]);
  }
  return unwrapped;
}
export function routeAppearance(
  index: number,
  recommended: number,
  geographic = false,
) {
  if (geographic)
    return { color: "#d7dfeb", pattern: "dotted" as const, dash: [2, 6] };
  if (index === recommended)
    return { color: "#94ddbf", pattern: "solid" as const, dash: undefined };
  const alternative =
    recommended >= 0 && index > recommended ? index - 1 : index;
  return alternative === 0
    ? { color: "#f3c084", pattern: "dashed" as const, dash: [10, 7] }
    : { color: "#becbff", pattern: "dotted" as const, dash: [2, 7] };
}
export function formatDistance(m: number) {
  return m >= 1000
    ? `${(m / 1000).toLocaleString(undefined, { maximumFractionDigits: m >= 100000 ? 0 : 2 })} km`
    : `${Math.round(m)} m`;
}
export function routeScore(
  routes: PlannedRoute[],
  settings: PlannerSettings,
): number[] {
  const distances = routes.map((r) => r.distance),
    risks = routes.map((r) => r.terrain?.riskIntegral ?? 0);
  const norm = (v: number, all: number[]) =>
    Math.max(...all) > Math.min(...all)
      ? (v - Math.min(...all)) / (Math.max(...all) - Math.min(...all))
      : 0;
  const science =
    settings.objectives.length > 0 && routes.some((r) => r.reached.length > 0)
      ? settings.scienceWeight
      : 0;
  const total = settings.distanceWeight + settings.terrainWeight + science || 1;
  return routes.map(
    (r) =>
      (settings.distanceWeight * norm(r.distance, distances) +
        settings.terrainWeight * norm(r.terrain?.riskIntegral ?? 0, risks) +
        science *
          (1 - r.reached.length / Math.max(1, settings.objectives.length))) /
      total,
  );
}
export const sphereRadiusM = MARS_RADIUS;
