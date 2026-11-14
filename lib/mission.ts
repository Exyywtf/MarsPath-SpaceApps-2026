import regional from "../public/processed/jezero.json";
import global from "../public/processed/mola-quarter.json";
import {
  cellCoordinate,
  coordinateCell,
  findPathAsync,
  measurePath,
  TerrainSearchTimeout,
  type PathResult,
  type Terrain,
  type TerrainMeta,
  type RouteResult,
} from "./routing";
import {
  draftPoints,
  geographicRoute,
  routeScore,
  within,
  type PlannerRequest,
  type PlannerResult,
  type PlannedRoute,
  type RoutingTier,
} from "./planner";
import { scienceTargets } from "./science";
import { marsDistance, type LonLat } from "./mars";
export function resolveCapability(request: PlannerRequest): {
  tier: RoutingTier;
  meta?: TerrainMeta;
  reason: string;
} {
  const points = draftPoints(request.draft);
  if (request.settings.geographicOnly)
    return {
      tier: "geographic",
      reason: "Geographic planning selected. Terrain is unassessed.",
    };
  if (points.some((p) => Math.abs(p[1]) === 90))
    return {
      tier: "geographic",
      reason:
        "An exact pole is unresolved by this cell-centre terrain grid. Geographic distance only.",
    };
  const meta: TerrainMeta = points.every((p) => within(regional, p))
    ? regional
    : global;
  const ids = points.map((p) => coordinateCell(meta, p));
  if (ids.some((id, i) => i > 0 && id === ids[i - 1]))
    return {
      tier: "geographic",
      reason:
        "At least one leg is smaller than the available terrain grid can resolve. Geographic distance only.",
    };
  return {
    tier: meta.id === regional.id ? "regional" : "coarse",
    meta,
    reason:
      meta.id === regional.id
        ? "Jezero CTX terrain · 20 m projected grid"
        : "Global MOLA · 0.25° derived cells (~14.8 km north–south)",
  };
}
export class LegCache {
  private entries = new Map<string, PathResult>();
  private cells = 0;
  get(key: string) {
    const entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      this.entries.set(key, entry);
    }
    return entry;
  }
  set(key: string, value: PathResult) {
    if (value.cells.length > 200000 || this.entries.has(key)) return;
    while (
      (this.cells + value.cells.length > 2000000 || this.entries.size >= 64) &&
      this.entries.size
    ) {
      const first = this.entries.keys().next().value!;
      this.cells -= this.entries.get(first)!.cells.length;
      this.entries.delete(first);
    }
    this.entries.set(key, value);
    this.cells += value.cells.length;
  }
}
export async function calculateMission(
  request: PlannerRequest,
  load: (meta: TerrainMeta) => Promise<Terrain>,
  cancelled: () => boolean,
  legs = new LegCache(),
): Promise<PlannerResult> {
  const inputPoints = draftPoints(request.draft);
  if (
    inputPoints.length < 2 ||
    request.draft.waypoints.length > 3 ||
    inputPoints.some(
      (p) => p.length !== 2 || !p.every(Number.isFinite) || Math.abs(p[1]) > 90,
    )
  )
    throw new Error(
      "Use two finite Mars coordinates and at most three waypoints.",
    );
  const started = performance.now(),
    capability = resolveCapability(request),
    { tier, meta, reason } = capability;
  if (tier === "geographic")
    return {
      routes: [geographicRoute(request.draft)],
      tier,
      reason,
      elapsedMs: performance.now() - started,
      cacheHits: 0,
      warnings: [],
    };
  const terrain = await load(meta!);
  if (cancelled()) throw new Error("Cancelled");
  const points = draftPoints(request.draft),
    warnings: string[] = [];
  const gridValidCells = terrain.valid.reduce(
    (sum, v) => sum + (v === 1 ? 1 : 0),
    0,
  );
  let cacheHits = 0,
    scienceAttempts = 0;
  const make = async (
    stops: LonLat[],
    mode: { id: string; name: string; lambda: number },
    optionalStop?: string,
    deadline = Infinity,
  ): Promise<PlannedRoute> => {
    const ids = stops.map((p) => coordinateCell(terrain.meta, p));
    let cells: number[] = [],
      cost = 0,
      expanded = 0;
    for (let i = 1; i < ids.length; i++) {
      if (cancelled()) throw new Error("Cancelled");
      const key = [
        terrain.meta.id,
        terrain.meta.derivedSha256 ?? terrain.meta.sha256,
        ids[i - 1],
        ids[i],
        request.settings.maxSlope,
        mode.lambda,
      ].join(":");
      let leg = legs.get(key);
      if (leg) cacheHits++;
      else {
        leg = await findPathAsync(
          terrain,
          ids[i - 1],
          ids[i],
          request.settings.maxSlope,
          mode.lambda,
          { cancelled, deadline: Math.min(deadline, performance.now() + 5000) },
        );
        legs.set(key, leg);
        expanded += leg.expanded;
      }
      cells = cells.concat(i === 1 ? leg.cells : leg.cells.slice(1));
      cost += leg.cost;
    }
    const measured = measurePath(terrain, cells, request.settings.maxSlope),
      snapping = stops.map((p, i) =>
        marsDistance(p, cellCoordinate(terrain.meta, ids[i])),
      );
    const pathSet = new Set(cells),
      reached =
        tier === "regional"
          ? [
              ...new Set(
                scienceTargets
                  .filter((t) =>
                    pathSet.has(coordinateCell(terrain.meta, t.coordinates)),
                  )
                  .flatMap((t) =>
                    t.objectives.filter((o) =>
                      request.settings.objectives.includes(o),
                    ),
                  ),
              ),
            ]
          : [];
    const route: RouteResult = {
      ...mode,
      ...measured,
      cells,
      cost,
      expanded,
      snapping,
    };
    return {
      id: mode.id,
      name: mode.name,
      tier,
      coordinates: measured.coordinates,
      distance:
        measured.distance +
        snapping.reduce(
          (sum, d, i) =>
            sum + d * (i === 0 || i === snapping.length - 1 ? 1 : 2),
          0,
        ),
      terrain: route,
      assessedDistance: measured.distance,
      snapping,
      connectors: stops.map((p, i) => [
        p,
        cellCoordinate(terrain.meta, ids[i]),
      ]),
      reached,
      scienceStops: optionalStop ? [optionalStop] : [],
      stops,
      quality: {
        validPathCells: cells.reduce(
          (n, i) => n + (terrain.valid[i] === 1 ? 1 : 0),
          0,
        ),
        pathCells: cells.length,
        gridValidCells,
        gridTotalCells: terrain.valid.length,
      },
      note: optionalStop
        ? "Includes a representative published type outcrop; precise sampling and safe access are not established."
        : undefined,
    };
  };
  const modes = [
    { id: "shortest", name: "Shortest feasible", lambda: 0 },
    {
      id: "terrain",
      name: "Lower modelled terrain risk",
      lambda: request.settings.riskWeight,
    },
    {
      id: "balanced",
      name:
        request.settings.objectives.length && tier === "regional"
          ? "Balanced science"
          : "Balanced terrain",
      lambda: 2,
    },
  ];
  const candidates: PlannedRoute[] = [];
  const terrainDeadline = performance.now() + 5000;
  for (const mode of modes) {
    try {
      candidates.push(await make(points, mode, undefined, terrainDeadline));
    } catch (error) {
      if (cancelled()) throw error;
      const message = (error as Error).message;
      if (!candidates.length) {
        if (tier === "coarse" && error instanceof TerrainSearchTimeout)
          return {
            routes: [geographicRoute(request.draft)],
            tier: "geographic",
            reason:
              "Coarse terrain search timed out. This connection reports geographic distance only.",
            elapsedMs: performance.now() - started,
            cacheHits,
            warnings: [message],
          };
        throw error;
      }
      warnings.push(mode.name + ": " + message);
    }
  }
  const science =
    tier === "regional"
      ? scienceTargets
          .filter((t) =>
            t.objectives.some((o) => request.settings.objectives.includes(o)),
          )
          .slice(0, 3)
      : [];
  const scienceDeadline = performance.now() + 5000;
  for (const target of science) {
    let completed = false;
    for (let insertion = 1; insertion < points.length; insertion++) {
      if (performance.now() > scienceDeadline) {
        warnings.push(
          "Science evaluation reached its five-second budget; unevaluated alternatives are not claimed optimal.",
        );
        break;
      }
      scienceAttempts++;
      const stops = [
        ...points.slice(0, insertion),
        target.coordinates,
        ...points.slice(insertion),
      ];
      try {
        const candidate = await make(
          stops,
          { ...modes[2], id: "science-" + target.id + "-" + insertion },
          target.id,
          scienceDeadline,
        );
        candidates.push(candidate);
        completed = true;
      } catch (error) {
        if (cancelled()) throw error;
        if (error instanceof TerrainSearchTimeout)
          warnings.push(target.name + ": evaluation timed out.");
      }
    }
    if (!completed)
      warnings.push(
        target.name +
          ": no feasible optional-stop candidate was found in the tested insertions and budget.",
      );
  }
  if (request.settings.objectives.length && tier !== "regional")
    warnings.push(
      "Local science-stop optimization is supported only by the verified Jezero targets. Regional destination themes are available in Explore.",
    );
  const allScores = routeScore(candidates, request.settings);
  const balanced = candidates
    .map((r, i) => ({ r, i }))
    .filter(
      ({ r }) =>
        r.terrain?.lambda === 2 && r.id !== "shortest" && r.id !== "terrain",
    )
    .sort((a, b) => allScores[a.i] - allScores[b.i])[0];
  const finalIndices = [
    0,
    candidates.findIndex((r) => r.id === "terrain"),
    balanced?.i ?? -1,
  ].filter((i, j, a) => i >= 0 && a.indexOf(i) === j);
  const routes = finalIndices.map((i) => ({
    ...candidates[i],
    id: jId(candidates[i]),
  }));
  return {
    routes,
    tier,
    reason,
    meta: terrain.meta,
    elapsedMs: performance.now() - started,
    cacheHits,
    warnings,
    scores: finalIndices.map((i) => allScores[i]),
    evaluatedCandidates: candidates.length,
    scienceAttempts,
  };
}
function jId(route: PlannedRoute) {
  return route.id.startsWith("science-") ? "balanced" : route.id;
}
