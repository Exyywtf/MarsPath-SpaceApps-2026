import manifest from "../public/processed/radiation-v1.json";
import { normalizeLon, type LonLat } from "./mars";

export const radiationManifest = manifest;
// Keep all three statically reproducible products. The column mass is a
// release fallback if the numerical dose checks fail, not a dose estimate.
export const radiationProduct: "radiation" | "radiation-column" = "radiation";
const [width, height] = manifest.pressureShape;
let pending: Promise<Float32Array> | undefined;

export function loadRadiationPressure() {
  pending ??= fetch(manifest.pressureUrl).then(async (response) => {
    if (!response.ok) throw new Error("Radiation model inputs could not load.");
    const data = new Float32Array(await response.arrayBuffer());
    if (data.length !== width * height) throw new Error("Radiation pressure grid has unexpected dimensions.");
    return data;
  }).catch((error) => { pending = undefined; throw error; });
  return pending;
}

export function radiationPressure(grid: ArrayLike<number>, [lon, lat]: LonLat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 89) return null;
  const x = normalizeLon(lon) + 180, y = 89 - lat;
  const i = Math.floor(x), j = Math.floor(y);
  const f = x-i, g = y-j;
  const k = Math.min(j+1, height-1), wrap = (i+1)%width;
  const a = grid[j*width+i], b = grid[j*width+wrap], c = grid[k*width+i], d = grid[k*width+wrap];
  if (![a,b,c,d].every((p) => Number.isFinite(p) && p > 0)) return null;
  return (a*(1-f)+b*f)*(1-g)+(c*(1-f)+d*f)*g;
}

export function effectiveDoseAtPressure(p: number) {
  const pressure = manifest.pressurePa, dose = manifest.effectiveDoseMsvPerYear;
  if (!Number.isFinite(p) || p < pressure[0] || p > pressure.at(-1)!) return null;
  const i = pressure.findIndex((v) => v >= p);
  if (i === 0) return dose[0];
  const t = (p-pressure[i-1])/(pressure[i]-pressure[i-1]);
  return dose[i-1]*(1-t)+dose[i]*t;
}

export function sampleRadiation(grid: ArrayLike<number>, point: LonLat) {
  const p = radiationPressure(grid, point);
  return p === null ? null : effectiveDoseAtPressure(p);
}

export function sampleColumn(grid: ArrayLike<number>, point: LonLat) {
  const p = radiationPressure(grid, point);
  return p === null ? null : p / manifest.proxyGravity;
}

export function historicalCoverage([lon, lat]: LonLat) {
  const d = Math.PI / 180;
  return manifest.historical.views.some(([, , , longitude, latitude]) =>
    Math.sin(lat*d)*Math.sin(latitude*d) +
    Math.cos(lat*d)*Math.cos(latitude*d)*Math.cos((lon-longitude)*d) >= manifest.historical.viewCosineCutoff,
  );
}
