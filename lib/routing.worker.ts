import { type Terrain, type TerrainMeta } from "./routing";
import type { PlannedRoute, PlannerRequest, PlannerResult } from "./planner";
import { calculateMission, calculateReturn, LegCache } from "./mission";
import { chooseCandidates, rankCandidates } from "./routeRanking";
import { analyseRoute, climateBounds, type RouteAnalysis } from "./routeAnalysis";
import { loadClimate } from "./layers";
import { loadRadiationPressure, radiationProduct } from "./radiation";
import type { ComparisonRequest, WorkerReply, WorkerRequest } from "./routeProtocol";
import { analyseEvidence, type RouteEvidence } from "./routeEvidence";
import { loadGeology, loadMineralObservations, loadThermalInertia } from "./explorationScience";
const legs = new LegCache();
const cache = new Map<string, { bytes: number; pending: Promise<Terrain> }>();
const TERRAIN_CACHE_LIMIT = 64 * 1024 * 1024;
let cacheBytes = 0,
  latest = 0;
async function load(meta: TerrainMeta) {
  const version = meta.derivedSha256 ?? meta.sha256;
  const existing = cache.get(version);
  if (existing) {
    cache.delete(version);
    cache.set(version, existing);
    return existing.pending;
  }
  const bytes = meta.width * meta.height * 9;
  if (bytes > TERRAIN_CACHE_LIMIT) {
    throw new Error("This terrain dataset exceeds the browser cache limit.");
  }
  while (cacheBytes + bytes > TERRAIN_CACHE_LIMIT && cache.size) {
    const key = cache.keys().next().value!;
    cacheBytes -= cache.get(key)!.bytes;
    cache.delete(key);
  }
  const pending = Promise.all(
    [meta.elevationUrl, meta.slopeUrl, meta.validUrl].map(async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Terrain download failed (${r.status}).`);
      return r.arrayBuffer();
    }),
  ).then((buffers) => {
    const terrain = {
      meta,
      elevation: new Float32Array(buffers[0]),
      slope: new Float32Array(buffers[1]),
      valid: new Uint8Array(buffers[2]),
    };
    if (
      terrain.elevation.length !== meta.width * meta.height ||
      terrain.slope.length !== terrain.elevation.length ||
      terrain.valid.length !== terrain.elevation.length
    )
      throw new Error("Terrain dimensions do not match metadata.");
    return terrain;
  });
  const entry = { bytes, pending };
  cache.set(version, entry);
  cacheBytes += bytes;
  try {
    return await pending;
  } catch (error) {
    if (cache.get(version) === entry) {
      cache.delete(version);
      cacheBytes -= bytes;
    }
    throw error;
  }
}
let desired: ComparisonRequest | undefined;
let accepted: {
  id: number;
  request: PlannerRequest;
  base: PlannerResult;
  pool: PlannedRoute[];
  analyses: Map<string, Promise<RouteAnalysis>>;
  evidence: Map<string, Promise<RouteEvidence>>;
  ranked?: ComparisonRequest;
} | undefined;
const post = (message: WorkerReply) => self.postMessage(message);
let activeComparison = 0;
let activeReturn = 0;
async function compare() {
  const job = accepted, request = desired;
  if (!job || !request || job.id !== latest) return;
  const revision = ++activeComparison, { settings, climate: preferences, key } = request;
  const current = () => latest === job.id && activeComparison === revision;
  const result = chooseCandidates(job.base, job.pool, settings);
  post({ id: job.id, key, kind: "routes", result: {
    ...result,
    ...rankCandidates(result.routes, settings, preferences),
  } });
  try {
    const [climate, pressure] = await Promise.all([
      loadClimate().catch(() => null),
      radiationProduct === "radiation" ? loadRadiationPressure().catch(() => null) : null,
    ]);
    if (!current()) return;
    const analysis: Record<string, RouteAnalysis> = {};
    for (const route of result.routes) {
      let pending = job.analyses.get(route.id);
      if (!pending) {
        pending = analyseRoute(route, climate, pressure, () => latest !== job.id);
        job.analyses.set(route.id,pending);
      }
      const measured = await pending;
      if (!current()) return;
      analysis[route.id] = measured;
    }
    const ranked = rankCandidates(result.routes, settings, preferences, analysis, climate ? climateBounds(climate) : undefined);
    post({ id: job.id, key, kind: "analysis", analysis, ...ranked });
  } catch (error) {
    if (current()) post({ id: job.id, key, kind: "analysis-error",
      error: error instanceof Error ? error.message : "Route profiles could not be calculated." });
  }
  if (!current()) return;
  try {
    const [geology, thermal, minerals] = await Promise.all([
      loadGeology().catch(() => null), loadThermalInertia().catch(() => null), loadMineralObservations().catch(() => null),
    ]);
    if (!current()) return;
    if (!geology && !thermal && !minerals) throw new Error("The exploration datasets could not load.");
    const evidence: Record<string, RouteEvidence> = {};
    for (const route of result.routes) {
      let pending = job.evidence.get(route.id);
      if (!pending) {
        pending = analyseEvidence(route, { geology, thermal, minerals }, () => latest !== job.id);
        // Partial results may be retried during the next comparison.
        if (geology && thermal && minerals) job.evidence.set(route.id, pending);
      }
      evidence[route.id] = await pending;
      if (!current()) return;
    }
    post({ id: job.id, key, kind: "evidence", evidence });
  } catch (error) {
    if (current()) post({ id: job.id, key, kind: "evidence-error",
      error: error instanceof Error ? error.message : "Scientific route evidence could not be calculated." });
  }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const input = event.data;
  if (input.kind === "cancel") {
    latest = input.id;
    accepted = undefined;
    desired = undefined;
    return;
  }
  if (input.id !== latest) return;
  if (input.kind === "return") {
    const revision = ++activeReturn;
    const job = accepted;
    if (!input.mode || !job) return;
    const cancelled = () => latest !== input.id || revision !== activeReturn;
    try {
      const result = await calculateReturn(job.request, input.mode === "geographic", load, cancelled, legs);
      if (!cancelled()) post({ kind: "return", id: input.id, key: input.key, result });
    } catch (error) {
      if (!cancelled()) post({ kind: "return", id: input.id, key: input.key,
        result: { status: "unavailable", reason: (error as Error).message } });
    }
    return;
  }
  desired = input.comparison;
  if (input.kind === "compare") {
    if (accepted?.ranked?.key === desired.key) return;
    if (accepted) accepted.ranked = desired;
    await compare();
    return;
  }
  const started = performance.now(),
    cancelled = () => latest !== input.id;
  try {
    const { pool, ...base } = await calculateMission(input, load, cancelled, legs);
    base.elapsedMs = performance.now() - started;
    if (!cancelled()) {
      accepted = { id: input.id, request: input, base, pool: pool ?? base.routes, analyses: new Map(), evidence: new Map(), ranked: desired };
      await compare();
    }
  } catch (error) {
    if (!cancelled())
      post({
        id: input.id, key: desired?.key ?? input.comparison.key, kind: "route-error",
        error: error instanceof Error ? error.message : String(error),
      });
  }
};
