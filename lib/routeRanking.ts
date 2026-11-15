import { routeScore, type PlannerResult, type PlannedRoute, type PlannerSettings } from "./planner";
import { groupRoutes } from "./routePresentation";
import { climateIds, type CellBounds, type ClimateBand, type ClimatePreferences, type RouteAnalysis } from "./routeAnalysis";
import type { ClimateId } from "./layers";

export type Ranking = {
  weights: { distance: number; terrain: number; science: number; climate: number };
  climate: Partial<Record<ClimateId, { reason: string; bounds?: [number, number][]; applied?: true }>>;
};

export function chooseCandidates(base: PlannerResult, pool: PlannedRoute[], settings: PlannerSettings) {
  const science = pool.filter(({ scienceStops }) => scienceStops?.length);
  const scores = routeScore(pool, settings);
  const scienceRoute = science.sort((a,b) =>
    b.reached.length-a.reached.length ||
    scores[pool.indexOf(a)]-scores[pool.indexOf(b)] ||
    a.distance-b.distance || a.id.localeCompare(b.id),
  )[0];
  const routes = pool.filter(({ scienceStops }) => !scienceStops?.length).map((r) =>
    r.id === "balanced" ? { ...r, name: "Balanced terrain" } : r,
  );
  if (scienceRoute) routes.push({ ...scienceRoute, name: "Science-aware route" });
  return groupRoutes({ ...base, routes });
}

function outsideBand(low: number, high: number, band: ClimateBand) {
  if (low > band.max || (band.min !== undefined && high < band.min)) return [1,1];
  if (high <= band.max && (band.min === undefined || low >= band.min)) return [0,0];
  return [0,1];
}

function routeBounds(route: RouteAnalysis, grid: Map<number,[number,number]>, band: ClimateBand) {
  let low = 0, high = 0, length = 0;
  const cells = new Set<number>();
  for (const span of route.samples) {
    if (span.role !== "terrain") continue;
    const key = span.climateCell;
    if (key === undefined) return;
    const cell = grid.get(key);
    if (!cell) return;
    const [lower,upper] = outsideBand(...cell,band);
    low += lower*span.length; high += upper*span.length; length += span.length;
    cells.add(key);
  }
  if (length) return { range: [low/length, high/length] as [number,number], cells };
}

export function rankCandidates(
  routes: PlannedRoute[], settings: PlannerSettings, preferences: ClimatePreferences,
  analysis?: Record<string,RouteAnalysis>, grid?: CellBounds,
) {
  const climate: Ranking["climate"] = {};
  if (preferences.enabled) for (const id of climateIds) {
    const band = preferences.bands[id];
    if (!band) continue;
    if (!preferences.weight) { climate[id] = { reason: "Climate weight is zero." }; continue; }
    if (routes.length < 2) { climate[id] = { reason: "There is one distinct route." }; continue; }
    if (!analysis) { climate[id] = { reason: "Calculating model coverage." }; continue; }
    const records = routes.map((route) => {
      const result = analysis[route.id];
      if (!result || !grid || (result.factors[id].coverage ?? 0) < 1-1e-8) return;
      return routeBounds(result,grid[id],band);
    });
    if (!records.every((r) => r !== undefined)) {
      climate[id] = { reason: "Comparable model coverage is incomplete." };
      continue;
    }
    const bounds = records.map(({range}) => range);
    let distinguishes = false, unresolved = false;
    for (let a=0; a<records.length; a++) for (let b=a+1; b<records.length; b++) {
      const [lo,hi] = bounds[a], [otherLo,otherHi] = bounds[b];
      const equal = Math.abs(lo-otherLo)<1e-8 && Math.abs(hi-otherHi)<1e-8;
      if (equal) continue;
      const sameCells = records[a].cells.size === records[b].cells.size &&
        [...records[a].cells].every((cell) => records[b].cells.has(cell));
      if (sameCells || !(hi < otherLo-1e-8 || otherHi < lo-1e-8)) unresolved = true;
      else distinguishes = true;
    }
    if (!distinguishes || unresolved) {
      climate[id] = { reason: "The climate grid cannot distinguish these alternatives under this preference.", bounds };
      continue;
    }
    climate[id] = { reason: "Used in ranking. The compared routes have separable model bounds.", bounds, applied: true };
  }
  return rankAcceptedCandidates(routes, settings, preferences, climate);
}

export function rankAcceptedCandidates(
  routes: PlannedRoute[], settings: PlannerSettings, preferences: ClimatePreferences, climate: Ranking["climate"] = {},
) {
  const weights = {
    distance: settings.distanceWeight,
    terrain: routes.every((route) => !!route.terrain) ? settings.terrainWeight : 0,
    science: settings.objectives.length && routes.some((route) => route.reached.length > 0) ? settings.scienceWeight : 0,
    climate: 0,
  };
  const sum = weights.distance + weights.terrain + weights.science;
  const eligible = preferences.enabled ? Object.values(climate).flatMap((field) =>
    field.applied && field.bounds?.length === routes.length ? [field.bounds] : []
  ) : [];
  if (eligible.length) weights.climate = sum ? preferences.weight/100 : 1;
  const rest = 1-weights.climate;
  if (sum) {
    weights.distance *= rest/sum;
    weights.terrain *= rest/sum;
    weights.science *= rest/sum;
  }
  const normalize = (value: number, values: number[]) => {
    const lo = Math.min(...values), hi = Math.max(...values);
    return hi > lo ? (value-lo)/(hi-lo) : 0;
  };
  const distances = routes.map((r) => r.distance);
  const terrain = routes.map((r) => r.terrain?.riskIntegral ?? 0);
  const scores = routes.map((route,i) =>
    weights.distance*normalize(distances[i],distances) +
    weights.terrain*normalize(terrain[i],terrain) +
    weights.science*(1-route.reached.length/Math.max(1,settings.objectives.length)) +
    weights.climate*(eligible.length ? eligible.reduce((total, bounds) => total+bounds[i][0],0)/eligible.length : 0),
  );
  return { scores, ranking: { weights, climate } satisfies Ranking };
}
