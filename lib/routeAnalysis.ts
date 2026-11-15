import { climateSnapshot, sampleGrid, type ClimateData, type ClimateId } from "./layers";
import { marsDistance, MARS_RADIUS, normalizeLon, radians, type LonLat } from "./mars";
import { radiationManifest as rad, sampleRadiation } from "./radiation";
import type { PlannedRoute } from "./planner";

export const climateIds = ["temperature", "pressure", "wind"] as const satisfies readonly ClimateId[];
export type FactorId = ClimateId | "radiation";
export const factorInfo = {
  temperature: { name: "Temperature", unit: "K", precision: 1 },
  pressure: { name: "Pressure", unit: "Pa", precision: 0 },
  wind: { name: "Wind speed", unit: "m/s", precision: 1 },
  radiation: { name: "Modelled effective dose rate", unit: "mSv/year", precision: 0 },
} as const;
export type SpanRole = "terrain" | "connector" | "geographic";
type Span = { a: LonLat; b: LonLat; role: SpanRole; dwell?: true };
export type FactorSample = {
  distance: number;
  length: number;
  point: LonLat;
  role: SpanRole;
  values: Record<FactorId, number | null>;
  climateCell?: number;
};
export interface FactorStats {
  min: number | null;
  max: number | null;
  mean: number | null;
  validLength: number;
  coverage: number | null;
  reason?: string;
  source: string;
  sourceData?: string;
  checksum: string;
  credit: string;
  terms: string;
  scenario: string;
  resolution: string;
  absoluteAccuracy: "Not established";
}
export interface RouteAnalysis {
  method: string;
  factors: Record<FactorId, FactorStats>;
  samples: FactorSample[];
  distance: number;
  elapsedMs: number;
}
export type ClimateBand = { min?: number; max: number };
export type ClimatePreferences = {
  enabled: boolean;
  weight: number;
  bands: Partial<Record<ClimateId, ClimateBand>>;
};
export const defaultClimatePreferences: ClimatePreferences = { enabled: false, weight: 20, bands: {} };
export type CellBounds = Record<ClimateId, Map<number, [number, number]>>;
export type SphericalVector = [number, number, number];
type Vec = SphericalVector;
const degrees = 180 / Math.PI;
const epsilon = 1e-10;
const climateLng = 360/63, climateLat = 180/47;

export function* orderedSpans(route: PlannedRoute, includeDwell = false): Generator<Span> {
  const points = route.coordinates;
  const stopIndices = route.stopIndices ?? [];
  if (route.tier === "geographic") {
    let stop = 1;
    for (let i = 1; i < points.length; i++) {
      yield { a: points[i-1], b: points[i], role: "geographic" };
      if (includeDwell && stop < stopIndices.length - 1 && stopIndices[stop] === i) {
        yield { a: points[i], b: points[i], role: "geographic", dwell: true };
        stop++;
      }
    }
    return;
  }
  let nextStop = 0;
  for (const [i, point] of points.entries()) {
    if (i) yield { a: points[i-1], b: point, role: "terrain" };
    while (stopIndices[nextStop] === i) {
      const [chosen, snapped] = route.connectors[nextStop];
      if (nextStop > 0) yield { a: snapped, b: chosen, role: "connector" };
      if (includeDwell && nextStop > 0 && nextStop < stopIndices.length - 1)
        yield { a: chosen, b: chosen, role: "connector", dwell: true };
      if (nextStop < stopIndices.length-1) yield { a: chosen, b: snapped, role: "connector" };
      nextStop++;
    }
  }
}

export const sphericalVector = ([lon, lat]: LonLat): Vec => {
  const a = radians(lon), f = radians(lat);
  return [Math.cos(f)*Math.cos(a), Math.cos(f)*Math.sin(a), Math.sin(f)];
};
export function sphericalArc(a: LonLat, b: LonLat) {
  const u = sphericalVector(a), end = sphericalVector(b), theta = marsDistance(a,b)/MARS_RADIUS;
  if (theta < 1e-12) return null;
  const dot = u[0]*end[0]+u[1]*end[1]+u[2]*end[2];
  let v = end.map((x,i) => x-dot*u[i]) as Vec;
  let n = Math.hypot(...v);
  if (n < 1e-12) {
    const axis: Vec = Math.abs(u[2]) < .9 ? [0,0,1] : [0,1,0];
    const d = axis[0]*u[0]+axis[1]*u[1]+axis[2]*u[2];
    v = axis.map((x,i) => x-d*u[i]) as Vec;
    n = Math.hypot(...v);
  }
  v = v.map((x) => x/n) as Vec;
  const at = (t: number): Vec => [
    u[0]*Math.cos(t)+v[0]*Math.sin(t),
    u[1]*Math.cos(t)+v[1]*Math.sin(t),
    u[2]*Math.cos(t)+v[2]*Math.sin(t),
  ];
  const lonLat = (t: number): LonLat => {
    const [x,y,z] = at(t);
    return [normalizeLon(Math.atan2(y,x)*degrees), Math.atan2(z,Math.hypot(x,y))*degrees];
  };
  return { u, v, end, theta, at, lonLat };
}

// Exact intersections of the spherical arc with meridian planes and latitude
// circles. Longitude is monotone between poles; split at the pole before
// enumerating meridians so the longitude discontinuity contributes no length.
export function sphericalIntervals(a: LonLat, b: LonLat, cellSize?: number): { point: LonLat; length: number }[] {
  const g = sphericalArc(a,b);
  if (!g) return [];
  const { u, v, theta, at, lonLat } = g, breaks = [0,theta], poles = [0,theta];
  const add = (t: number) => { if (t > epsilon && t < theta-epsilon) breaks.push(t); };
  const zPhase = Math.atan2(v[2],u[2]), amplitude = Math.hypot(u[2],v[2]);
  const extrema = [zPhase, zPhase+Math.PI, zPhase-Math.PI, zPhase+2*Math.PI].filter((t) =>
    t > epsilon && t < theta-epsilon);
  const latitudes = [a[1], b[1]];
  for (const t of extrema) {
    latitudes.push(lonLat(t)[1]);
    if (Math.hypot(...at(t).slice(0,2)) < 1e-8) { add(t); poles.push(t); }
  }
  function latLines(base: number, step: number) {
    if (amplitude < epsilon) return;
    const lo = Math.min(...latitudes), hi = Math.max(...latitudes);
    for (let i=Math.ceil((lo-base)/step); base+i*step < hi; i++) {
      const c = Math.sin(radians(base+i*step))/amplitude;
      if (Math.abs(c) > 1) continue;
      const angle = Math.acos(c);
      for (const t of [zPhase+angle,zPhase-angle]) { add(t); add(t+2*Math.PI); add(t-2*Math.PI); }
    }
  }
  if (cellSize) latLines(-90, cellSize);
  else {
    latLines(-90,climateLat);
    latLines(-89,1);
  }
  poles.sort((x,y) => x-y);
  for (let p=1; p<poles.length; p++) {
    const start = poles[p-1], end = poles[p];
    const from = lonLat(start + 1e-8*(end-start))[0];
    const to = from + normalizeLon(lonLat(end - 1e-8*(end-start))[0]-from);
    function meridians(step: number) {
      const lo = Math.min(from,to), hi = Math.max(from,to);
      for (let i=Math.ceil((lo+180)/step); -180+i*step < hi; i++) {
        const lon = radians(-180+i*step), s = Math.sin(lon), c = Math.cos(lon);
        const t0 = Math.atan2(u[0]*s-u[1]*c, v[1]*c-v[0]*s);
        // Reject the opposite ray of the same meridian plane.
        for (const t of [t0, t0+Math.PI, t0-Math.PI, t0+2*Math.PI]) {
          if (t <= start+epsilon || t >= end-epsilon) continue;
          const x = at(t);
          if (x[0]*c+x[1]*s > epsilon) add(t);
        }
      }
    }
    if (cellSize) meridians(cellSize);
    else {
      meridians(climateLng);
      meridians(1);
    }
  }
  const sorted = breaks.sort((x,y) => x-y);
  const result: { point: LonLat; length: number }[] = [];
  for (let k=1; k<sorted.length; k++) {
    const length = (sorted[k]-sorted[k-1])*MARS_RADIUS;
    if (length <= 1e-6) continue;
    const n = Math.ceil(length/25000);
    for (let j=0; j<n; j++)
      result.push({ point: lonLat(sorted[k-1]+(sorted[k]-sorted[k-1])*(j+.5)/n), length: length/n });
  }
  return result;
}

function climateCell([lon, lat]: LonLat) {
  if (Math.abs(lat) >= 90) return;
  return Math.min(46,Math.floor((90-lat)/climateLat))*63 +
    Math.min(62,Math.floor((normalizeLon(lon)+180)/climateLng));
}

export function sampleClimate(data: ClimateData, id: ClimateId, point: LonLat) {
  const { values } = data.fields[id], { width, height } = data;
  if (Math.abs(point[1]) === 90) {
    const start = point[1] > 0 ? 0 : (height-1)*width;
    const pole = values[start];
    if (values.slice(start,start+width).some((value) => value !== pole)) return null;
  }
  return sampleGrid(values,width,height,point,true);
}

const knownBounds = new WeakMap<ClimateData, CellBounds>();
export function climateBounds(data: ClimateData): CellBounds {
  const cached = knownBounds.get(data);
  if (cached) return cached;
  const bounds = Object.fromEntries(climateIds.map((id) => {
    const field = data.fields[id].values, cells = new Map<number,[number,number]>();
    for (let y=0; y<47; y++) for (let x=0; x<63; x++) {
      const i = y*64+x;
      const corners = [field[i],field[i+1],field[i+64],field[i+65]];
      if (corners.every(Number.isFinite)) cells.set(y*63+x,[Math.min(...corners),Math.max(...corners)]);
    }
    return [id,cells];
  })) as CellBounds;
  knownBounds.set(data,bounds);
  return bounds;
}

export async function analyseRoute(
  route: PlannedRoute,
  climate: ClimateData | null,
  pressure: ArrayLike<number> | null,
  cancelled: () => boolean = () => false,
): Promise<RouteAnalysis> {
  const started = performance.now(), samples: FactorSample[] = [];
  const ids = [...climateIds, "radiation"] as const;
  const total = Object.fromEntries(ids.map((id) => [id, { sum: 0, min: Infinity, max: -Infinity, length: 0 }])) as
    Record<FactorId,{sum: number; min: number; max: number; length: number}>;
  let distance = 0, nextYield = started + 5, count = 0;
  for (const {a,b,role} of orderedSpans(route)) {
    if ((++count & 63) === 0 && performance.now() >= nextYield) {
      await new Promise<void>((done) => setTimeout(done,0));
      if (cancelled()) throw new Error("Cancelled");
      nextYield = performance.now() + 5;
    }
    for (const {point,length} of sphericalIntervals(a,b)) {
      const cell = climateCell(point);
      const values = {
        temperature: climate ? sampleClimate(climate,"temperature",point) : null,
        pressure: climate ? sampleClimate(climate,"pressure",point) : null,
        wind: climate ? sampleClimate(climate,"wind",point) : null,
        radiation: pressure ? sampleRadiation(pressure,point) : null,
      };
      for (const id of ids) {
        const value = values[id], stats = total[id];
        if (value === null) continue;
        stats.sum += length*value;
        stats.length += length;
        stats.min = Math.min(stats.min,value); stats.max = Math.max(stats.max,value);
      }
      samples.push({ distance: distance+length/2, length, point, role, values, climateCell: cell });
      distance += length;
    }
  }
  if (cancelled()) throw new Error("Cancelled");
  const factors = Object.fromEntries(ids.map((id) => {
    const s = total[id], has = s.length > 0, dose = id === "radiation";
    return [id, {
      min: has ? s.min : null, max: has ? s.max : null, mean: has ? s.sum/s.length : null,
      validLength: s.length, coverage: distance ? Math.min(1,s.length/distance) : null,
      reason: !has ? !distance ? "The route has no length." :
        (dose ? !pressure : !climate) ? "The static numerical dataset could not load." : "No coverage along this route." : undefined,
      source: dose ? rad.source : climateSnapshot.source,
      sourceData: dose ? rad.data : undefined, checksum: dose ? rad.archiveSha256 : climateSnapshot.sha256,
      credit: dose ? rad.credit : climateSnapshot.credit, terms: dose ? rad.terms : climateSnapshot.terms,
      scenario: dose ? rad.scenario : climateSnapshot.scenario,
      resolution: dose ? "1° pressure grid · six model pressures" : climateSnapshot.sampling,
      absoluteAccuracy: "Not established",
    } satisfies FactorStats];
  })) as Record<FactorId,FactorStats>;
  return {
    method: "Spherical multipart trace through intended stops. Split at model grid lines and into intervals up to 25 km. Distance-weighted midpoint samples.",
    factors, samples, distance, elapsedMs: performance.now()-started,
  };
}
