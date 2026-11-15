import manifest from "../data/meda-observations.json";

export const medaManifest = manifest;
export interface MedaSample {
  sourceRow: number;
  sclk: number;
  utc: string;
  lmst: string;
  ltst: string;
  pressurePa: number | null;
  transducer: number | null;
  temperatureK: (number | null)[];
  positionM: number[] | null;
  roverSpeedMps: number | null;
}
export interface MedaSeries {
  sol: number;
  pressureProduct: string;
  temperatureProduct: string;
  positionProduct: string;
  samples: MedaSample[];
  gaps: { startSclk: number; stopSclk: number; utcStart: string; utcStop: string }[];
  temperatureGaps: { startSclk: number; stopSclk: number }[];
}
export interface MedaData {
  version: string;
  sampling: string;
  positionFrame: string;
  sensors: { channel: number; name: string; heightM: number }[];
  products: { id: string; file: string; url: string; labelUrl: string; sha256: string; labelSha256: string }[];
  series: MedaSeries[];
  limitations: string[];
  rankingWeight: number;
}

let pending: Promise<MedaData> | undefined;
export function loadMedaObservations() {
  return pending ??= fetch(manifest.url).then(async (response) => {
    if (!response.ok) throw new Error("The historical observation series could not be loaded.");
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== manifest.bytes) throw new Error("Historical observation file length differs from its source record.");
    if (globalThis.crypto?.subtle) {
      const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
      if (Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("") !== manifest.sha256)
        throw new Error("Historical observation checksum differs from its source record.");
    }
    const data: MedaData = JSON.parse(new TextDecoder().decode(buffer));
    if (data.version !== manifest.id || data.series.length !== 3 || data.rankingWeight !== 0)
      throw new Error("Historical observation metadata could not be verified.");
    return data;
  }).catch((error) => { pending = undefined; throw error; });
}

export function medaMeanHours(value: string) {
  const [hour, minute, seconds] = value.split("M")[1].split(":").map(Number);
  return hour + minute / 60 + seconds / 3600;
}

export function medaProfileSegments(series: MedaSeries, channel: number) {
  const segments: { hours: number; value: number }[][] = [];
  let previous: MedaSample | undefined;
  let current: { hours: number; value: number }[] = [];
  const gaps = channel ? series.temperatureGaps : series.gaps;
  for (const sample of series.samples) {
    const value = channel ? sample.temperatureK[channel - 1] : sample.pressurePa;
    const gap = previous && gaps.some((gap) => gap.stopSclk > previous!.sclk && gap.startSclk < sample.sclk);
    if (gap || value === null) {
      if (current.length) segments.push(current);
      current = [];
    }
    if (value !== null) current.push({ hours: medaMeanHours(sample.lmst), value });
    previous = sample;
  }
  if (current.length) segments.push(current);
  return segments;
}
