import { type Terrain, type TerrainMeta } from "./routing";
import { type PlannerRequest } from "./planner";
import { calculateMission, LegCache } from "./mission";
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
self.onmessage = async (
  event: MessageEvent<PlannerRequest | { id: number; cancel: true }>,
) => {
  const input = event.data;
  latest = input.id;
  if ("cancel" in input) return;
  const started = performance.now(),
    cancelled = () => latest !== input.id;
  try {
    const result = await calculateMission(input, load, cancelled, legs);
    result.elapsedMs = performance.now() - started;
    if (!cancelled()) self.postMessage({ id: input.id, result });
  } catch (error) {
    if (!cancelled())
      self.postMessage({
        id: input.id,
        error: error instanceof Error ? error.message : String(error),
      });
  }
};
