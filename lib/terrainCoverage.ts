import manifest from "../data/terrain-coverage.json";
import { molaTerrain, regionalTerrains } from "./terrainRegistry";
import { coordinateCell, type TerrainMeta } from "./routing";
import { within } from "./planner";
import { scienceTargets } from "./science";
import type { LonLat } from "./mars";

export const terrainCoverage = manifest;
type Mask = { meta: TerrainMeta; cells: Uint8Array };

export function inspectTerrainCoverage(point: LonLat, global: Mask, regions: Mask[]) {
  const region = regions.find(({ meta, cells }) => within(meta, point) && cells[coordinateCell(meta, point)] === 1);
  const coarse = global.cells[coordinateCell(global.meta, point)] === 1;
  const meta = region?.meta ?? (coarse ? global.meta : undefined);
  const targets = region ? scienceTargets.filter((target) => within(region.meta, target.coordinates) &&
    coordinateCell(region.meta, point) === coordinateCell(region.meta, target.coordinates)).map(({ name }) => name) : [];
  return { tier: region ? "regional" as const : coarse ? "coarse" as const : "missing" as const, meta, targets };
}

let pending: Promise<(point: LonLat) => ReturnType<typeof inspectTerrainCoverage>> | undefined;
export function loadCoverageMasks() {
  return pending ??= Promise.all([molaTerrain, ...regionalTerrains].map(async (meta): Promise<Mask> => {
    const response = await fetch(meta.validUrl);
    if (!response.ok) throw new Error("Terrain coverage mask is unavailable.");
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== meta.width * meta.height) throw new Error("Terrain coverage mask dimensions differ.");
    const record = [manifest.global, ...manifest.regions].find(({ id }) => id === meta.id);
    if (!record) throw new Error("Terrain coverage source is not registered.");
    if (globalThis.crypto?.subtle) {
      const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
      if (Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("") !== record.maskSha256)
        throw new Error("Terrain coverage mask checksum differs.");
    }
    return { meta, cells: new Uint8Array(buffer) };
  })).then(([global, ...regions]) => (point: LonLat) => inspectTerrainCoverage(point, global, regions)).catch((error) => {
    pending = undefined;
    throw error;
  });
}
