import records from "../data/layers.json";
import { normalizeLon, type LonLat } from "./mars";
import { radiationManifest as rad, radiationProduct } from "./radiation";
import { explorationScience, scienceSources, thermalUnit } from "./explorationScience";
export type ClimateId = "temperature" | "pressure" | "wind";
export type RadiationId = "radiation" | "radiation-historical" | "radiation-column";
export type ExplorationLayerId = "geology" | "minerals" | "thermal-inertia";
export type LayerId = "topography" | ClimateId | RadiationId | ExplorationLayerId;
interface LayerMetadata {
  id: LayerId;
  name: string;
  unit: string;
  sampling: string;
  nativeResolution: string;
  kind: string;
  sourcePage: string;
  sha256: string;
  processedAt?: string;
  context: string;
  terms: string;
}
interface RasterDataset extends LayerMetadata {
  imageUrl: string;
  imageSize: number[];
  bounds: number[];
  interpolate?: boolean;
}
interface ScalarDataset extends RasterDataset {
  range: number[];
  palette: string[];
}
interface NumericalDataset extends ScalarDataset {
  id: Exclude<LayerId, "radiation-historical" | "geology" | "minerals">;
  dataUrl: string;
  presentation: "numerical";
}
interface ReferenceDataset extends ScalarDataset {
  id: "radiation-historical";
  presentation: "historical";
}
interface CategoricalDataset extends RasterDataset {
  id: "geology";
  presentation: "categorical";
}
interface ObservationsDataset extends LayerMetadata {
  id: "minerals";
  presentation: "observations";
}
export type LayerDataset = NumericalDataset | ReferenceDataset | CategoricalDataset | ObservationsDataset;
export interface ClimateData {
  width: number;
  height: number;
  fields: Record<
    string,
    { values: number[]; range: number[]; seamMaxDifference: number }
  >;
  sha256: string;
  providerGeneratedAt: string;
}
const cosmicRays: NumericalDataset = {
  id: "radiation", name: "Modelled cosmic rays", unit: "mSv/year",
  presentation: "numerical", range: rad.modelRange, palette: rad.modelPalette,
  imageUrl: "/processed/radiation-atris-v1.png", imageSize: rad.imageSize, bounds: rad.bounds,
  sampling: "1° pressure nodes · six radiation simulations",
  nativeResolution: "A transport simulation at six atmospheric pressures",
  kind: "Modelled surface effective dose rate",
  sourcePage: rad.source, dataUrl: rad.pressureUrl, sha256: rad.archiveSha256,
  context: rad.scenario + ". Model sensitivity is not known at a point; excludes solar particle events.",
  terms: rad.terms,
};
const column: NumericalDataset = {
  ...cosmicRays, id: "radiation-column", name: "Atmospheric shielding proxy", unit: "kg/m²",
  range: rad.proxyRange, kind: "Modelled vertical atmospheric column mass",
  imageUrl: "/processed/radiation-column-v1.png",
  sampling: "1° published surface pressure nodes",
  nativeResolution: "Pressure export spacing, not local atmospheric accuracy",
  context: "Ls 0° at local midnight. Surface pressure divided by 3.72 m/s² under hydrostatic equilibrium. Column mass only; radiation dose is unavailable.",
};
const historical: ReferenceDataset = {
  id: "radiation-historical", name: "NASA historical map · 2002", unit: "rem/year",
  presentation: "historical", range: [10, 20], palette: rad.historical.palette,
  imageUrl: "/processed/radiation-pia03480-v1.webp", imageSize: rad.imageSize, bounds: rad.bounds,
  sampling: "Two orthographic views fitted to NASA’s printed graticule",
  nativeResolution: "Original model grid unknown. Artwork: 3000 × 2400 pixels.",
  kind: "Historical dose-equivalent illustration",
  sourcePage: rad.historical.source, sha256: rad.historical.sourceSha256,
  context: "NASA/JPL/JSC, 2002. Colours and scale come from the original illustration. Areas outside the usable views remain transparent.",
  terms: rad.historical.terms,
};

const geology: CategoricalDataset = {
  id: "geology", presentation: "categorical", name: "Global geology", unit: "",
  imageUrl: explorationScience.geology.image.url, imageSize: [explorationScience.geology.width, explorationScience.geology.height],
  bounds: explorationScience.geology.bounds, interpolate: false,
  sampling: "Polygon membership at 0.125° cell centres · about 7.4 km north–south",
  nativeResolution: "SIM 3292 · 1:20,000,000 map scale",
  kind: "USGS mapped geologic units", sourcePage: scienceSources.geology.url,
  sha256: explorationScience.geology.data.sha256, terms: scienceSources.geology.terms,
  context: "44 units with published codes and colours. Click to inspect the mapped unit and polygon ID. Boundaries are regional interpretations; small outcrops may be unresolved.",
};
const minerals: ObservationsDataset = {
  id: "minerals", presentation: "observations", name: "Mineral observations", unit: "",
  sampling: "Published observation centres and detection locations",
  nativeResolution: "Coordinate precision varies by catalogue. The PDS table prints coordinates to 0.01°.",
  kind: "Published OMEGA, CRISM and THEMIS records", sourcePage: scienceSources.minerals.url,
  sha256: explorationScience.minerals.data.sha256, terms: scienceSources.minerals.terms + " " + scienceSources.hydrated.terms,
  context: `${explorationScience.hydrated.count.toLocaleString("en-US")} NASA PDS hydrated mineral records, ${explorationScience.minerals.crismCount} Terra Sirenum CRISM observation centres and ${explorationScience.minerals.chlorideCount} chloride catalogue records. Surveys are uneven. The PDS table locates detections and omits species and footprints.`,
};
const thermal: NumericalDataset = {
  id: "thermal-inertia", presentation: "numerical", name: "Thermal inertia", unit: thermalUnit,
  range: explorationScience.thermal.displayRange, palette: explorationScience.thermal.palette,
  imageUrl: explorationScience.thermal.image.url,
  imageSize: [explorationScience.thermal.width, explorationScience.thermal.height],
  bounds: explorationScience.thermal.bounds, interpolate: false, dataUrl: explorationScience.thermal.data.url,
  sampling: "0.25° area-weighted cells · about 14.8 km north–south",
  nativeResolution: "20 pixels/degree · about 2.96 km per pixel at the equator",
  kind: "TES nightside apparent thermal inertia", sourcePage: scienceSources.thermal.url,
  sha256: explorationScience.thermal.data.sha256, terms: scienceSources.thermal.terms,
  context: "MGS TES nightside bolometer temperatures from 1999–2004, modelled as apparent thermal inertia. Only cells fully supported by the PDS observation mask are shown. High values share the top legend colour.",
};
export const scientificLayers: LayerDataset[] = [
  ...records.map((record) => ({ ...record, presentation: "numerical" } as NumericalDataset)),
  radiationProduct === "radiation" ? cosmicRays : column,
  historical,
  geology, minerals, thermal,
];

export function isRadiation(id: LayerId | null): id is RadiationId {
  return id === "radiation" || id === "radiation-historical" || id === "radiation-column";
}

export function sourceAnchor(id: LayerId) {
  if (id === "geology" || id === "minerals" || id === "thermal-inertia") return id;
  return id === "topography" ? "mola" : isRadiation(id)
    ? id === "radiation-historical" ? "pia03480" : "atris-radiation"
    : "mcd";
}

export const climateSnapshot = {
  url: "/processed/mcd-v62.json",
  sha256: "aabe016b2609e0a083d47f9be782de94f13204e8d5c0c1c6f11867b8eeb02cbd",
  source: "https://www-mars.lmd.jussieu.fr/mcd_python/",
  terms: "https://www-mars.lmd.jussieu.fr/mars/access",
  credit: "Mars Climate Database © LMD / OU / IAA / ESA / CNES",
  scenario: "MCD 6.2 · Ls 21.3° · local time 00:00 everywhere · 10 m above the local surface · average-solar climatology",
  sampling: "64 × 48 export nodes (5.714° × 3.830°); native resolution unknown",
} as const;
let climatePromise: Promise<ClimateData> | undefined;
export function loadClimate() {
  climatePromise ??= fetch(climateSnapshot.url).then(async (r) => {
    if (!r.ok) throw new Error("Climate snapshot could not load.");
    const data = await r.json() as ClimateData;
    if (data.sha256 !== climateSnapshot.sha256 || data.width !== 64 || data.height !== 48 ||
      (["temperature", "pressure", "wind"] as const).some((id) =>
        data.fields[id]?.values.length !== data.width * data.height))
      throw new Error("Climate snapshot does not match its manifest.");
    return data;
  }).catch((error) => { climatePromise = undefined; throw error; });
  return climatePromise;
}
// Both image generation and inspection use the same numerical linear sampling.
export function sampleGrid(
  values: ArrayLike<number>,
  width: number,
  height: number,
  p: LonLat,
  nodeGrid: boolean,
): number | null {
  if (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[1]) > 90)
    return null;
  let x =
    ((normalizeLon(p[0]) + 180) / 360) * (nodeGrid ? width - 1 : width) -
    (nodeGrid ? 0 : 0.5);
  let y =
    ((90 - p[1]) / 180) * (nodeGrid ? height - 1 : height) -
    (nodeGrid ? 0 : 0.5);
  y = Math.max(0, Math.min(height - 1, y));
  if (nodeGrid) x = Math.max(0, Math.min(width - 1, x));
  const base = Math.floor(x),
    x0 = ((base % width) + width) % width,
    x1 = nodeGrid ? Math.min(width - 1, x0 + 1) : (x0 + 1) % width,
    y0 = Math.floor(y),
    y1 = Math.min(height - 1, y0 + 1),
    fx = x - base,
    fy = y - y0;
  const a = values[y0 * width + x0],
    b = values[y0 * width + x1],
    c = values[y1 * width + x0],
    d = values[y1 * width + x1];
  if (![a, b, c, d].every(Number.isFinite)) return null;
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}
export function layerValue(value: number, id: LayerId) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: id === "wind" ? 2 : id === "topography" || isRadiation(id) ? 0 : 1,
  });
}
