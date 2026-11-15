import manifest from "../data/exploration-science.json";
import hydrated from "../data/hydrated-sites.json";
import { normalizeLon, type LonLat } from "./mars";

export const explorationScience = { ...manifest, version: "science-v2", hydrated };
export const thermalUnit = "J m⁻² K⁻¹ s⁻½";
export const scienceSources = {
  geology: {
    url: "https://pubs.usgs.gov/publication/sim3292",
    collection: "https://astrogeology.usgs.gov/pygeoapi/collections/mars/sim3292_global_geologic_map/units?f=html",
    credit: "Tanaka et al. (2014) · U.S. Geological Survey SIM 3292",
    terms: "USGS public domain. Credit the authors and USGS.",
  },
  minerals: {
    url: "https://data.caltech.edu/records/yhd9q-q8g95",
    chloride: "https://data.caltech.edu/records/kasms-vp209",
    credit: "Leask et al. (2024); Leask & Ehlmann (2021), after Osterloo et al. (2010)",
    terms: "The two Caltech data deposits are CC0 1.0. Credit the authors and instrument teams.",
  },
  hydrated: {
    url: hydrated.url, study: hydrated.study, termsUrl: hydrated.termsUrl,
    credit: hydrated.credit, terms: hydrated.terms,
  },
  thermal: {
    url: "https://pds-geosciences.wustl.edu/missions/mgs/tes-timap.html",
    credit: "Putzig, Mellon, Heet and Ward (2009) · NASA PDS MGS-M-TES-5-TIMAP-V1.0",
    terms: "Public NASA PDS mission data. Retain the archive citation and credit.",
  },
  dust: {
    url: "https://www.mars.asu.edu/~ruff/DCI/dci.html",
    credit: "Ruff & Christensen (2002) · Arizona State University",
  },
  ice: {
    url: "https://pubs.usgs.gov/publication/70263883",
    paper: "https://doi.org/10.3847/PSJ/ad9b24",
    credit: "Morgan et al. (2025) · Subsurface Water Ice Mapping",
  },
} as const;

export const mineralStyles = {
  crism: { label: "CRISM observation centre", color: "#63e1d1", instrument: "MRO · CRISM", source: scienceSources.minerals.url },
  chloride: { label: "Chloride catalogue record", color: "#ffbb65", instrument: "Mars Odyssey · THEMIS", source: scienceSources.minerals.chloride },
  hydrated: { label: "Hydrated mineral site", color: "#d8b9ff", source: scienceSources.hydrated.url },
} as const;

type Asset = { url: string; sha256: string; bytes: number };
export type ScienceGrid = { width: number; height: number; cells: Uint16Array };
type ObservationCentre = { id: string; point: LonLat };
type InitialObservation = ObservationCentre & ({ kind: "crism"; interpretation: string } | { kind: "chloride"; label: string });
type HydratedSite = ObservationCentre & { kind: "hydrated"; sourceRows: number[]; omegaProduct?: string; crismProduct?: string };
export type MineralObservation = InitialObservation | HydratedSite;
export type GeologicUnit = (typeof manifest.geology.units)[number];
const unitByCode = new Map(manifest.geology.units.map((unit) => [unit.code, unit]));

async function readAsset(asset: Asset) {
  const result = await fetch(asset.url);
  if (!result.ok) throw new Error("Scientific dataset is unavailable.");
  const data = await result.arrayBuffer();
  if (data.byteLength !== asset.bytes) throw new Error("Scientific dataset length differs from the manifest.");
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", data);
    if (Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("") !== asset.sha256)
      throw new Error("Scientific dataset checksum differs from the manifest.");
  }
  return data;
}

async function readJson<T>(asset: Asset): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await readAsset(asset))) as T;
}

export function decodeScienceGrid(input: ArrayBuffer, width: number, height: number): ScienceGrid {
  const raw = new DataView(input);
  const cells = new Uint16Array(width * height);
  if (raw.byteLength % 4 !== 0) throw new Error("Invalid scientific grid encoding.");
  let start = 0;
  for (let i = 0; i < raw.byteLength; i += 4) {
    const length = raw.getUint16(i, true), value = raw.getUint16(i + 2, true);
    const end = start + length;
    if (length === 0 || end > cells.length) throw new Error("Invalid scientific grid run.");
    cells.fill(value, start, end);
    start = end;
  }
  if (start !== cells.length) throw new Error("Scientific grid is truncated.");
  return { width, height, cells };
}

async function readGrid(grid: { width: number; height: number; data: Asset; encoding: string }): Promise<ScienceGrid> {
  const { width, height } = grid;
  const compressed = await readAsset(grid.data);
  const input = await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  if (grid.encoding === "rle16") return decodeScienceGrid(input, width, height);
  if (grid.encoding !== "uint16" || input.byteLength !== 2 * width * height) throw new Error("Invalid scientific grid encoding.");
  const raw = new DataView(input);
  const cells = Uint16Array.from({ length: width * height }, (_, i) => raw.getUint16(2 * i, true));
  return { width, height, cells };
}

function lazy<T>(load: () => Promise<T>) {
  let pending: Promise<T> | undefined;
  return () => pending ??= load().catch((error) => { pending = undefined; throw error; });
}

export const loadGeology = lazy(async () => {
  const [grid, catalog] = await Promise.all([
    readGrid(manifest.geology), readJson<Record<string, string>>(manifest.geology.catalog),
  ]);
  return { ...grid, catalog };
});
export type GeologyGrid = Awaited<ReturnType<typeof loadGeology>>;
export const loadThermalInertia = lazy(() => readGrid(manifest.thermal));
const loadInitialObservations = lazy(() => readJson<InitialObservation[]>(manifest.minerals.data));
const loadHydratedSites = lazy(() => readJson<HydratedSite[]>(hydrated.data));
export const loadMineralObservations = lazy(async () => {
  const [original, sites] = await Promise.all([loadInitialObservations(), loadHydratedSites()]);
  return [...original, ...sites];
});

export function scienceCellIndex(width: number, height: number, [lon, lat]: LonLat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90) return -1;
  const column = Math.min(width - 1, Math.floor((normalizeLon(lon) + 180) / 360 * width));
  const row = Math.min(height - 1, Math.floor((90 - lat) / 180 * height));
  return row * width + column;
}

export function scienceCellValue(grid: ScienceGrid, point: LonLat) {
  return grid.cells[scienceCellIndex(grid.width, grid.height, point)] || null;
}

export function sampleGeology(grid: GeologyGrid, point: LonLat) {
  const featureId = scienceCellValue(grid, point);
  if (featureId === null) return null;
  const unit = unitByCode.get(grid.catalog[featureId]);
  return unit ? { ...unit, featureId } : null;
}
