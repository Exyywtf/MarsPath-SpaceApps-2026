"use client";
import { useEffect, useState } from "react";
import { loadClimate, sampleGrid, type LayerDataset } from "./layers";
import type { LonLat } from "./mars";
import { historicalCoverage, loadRadiationPressure, sampleColumn, sampleRadiation } from "./radiation";
import { sampleClimate } from "./routeAnalysis";
import { loadGeology, loadMineralObservations, loadThermalInertia, sampleGeology, scienceCellValue, type MineralObservation } from "./explorationScience";

type InspectionValue = number | NonNullable<ReturnType<typeof sampleGeology>> | MineralObservation[] | null;
type Sampler = (point: LonLat, observations: readonly string[]) => InspectionValue;
const samplers = new Map<string, Promise<Sampler>>();
function load(layer: Exclude<LayerDataset, { presentation: "historical" }>): Promise<Sampler> {
  const id = layer.id;
  if (samplers.has(id)) return samplers.get(id)!;
  const pending = createSampler(layer);
  samplers.set(id, pending);
  pending.catch(() => samplers.delete(id));
  return pending;
}

function createSampler(layer: Exclude<LayerDataset, { presentation: "historical" }>): Promise<Sampler> {
  const id = layer.id;
  switch (id) {
    case "geology":
      return loadGeology().then((grid) => (point) => sampleGeology(grid, point));
    case "minerals":
      return loadMineralObservations().then((items) => {
        const indexed = new Map(items.map((item) => [`${item.kind}:${item.id}`, item]));
        return (_, hits) => hits.flatMap((hit) => indexed.get(hit) ?? []);
      });
    case "thermal-inertia":
      return loadThermalInertia().then((grid) => (point) => scienceCellValue(grid, point));
    case "topography":
      return fetch(layer.dataUrl).then(async (r) => {
        if (!r.ok) throw new Error("Elevation download failed.");
        const values = new Float32Array(await r.arrayBuffer());
        return (point) => sampleGrid(values, 1440, 720, point, false);
      });
    case "radiation":
    case "radiation-column":
      return loadRadiationPressure().then((grid) => (point) =>
        (id === "radiation" ? sampleRadiation : sampleColumn)(grid, point));
    default:
      return loadClimate().then((data) => (point) => sampleClimate(data, id, point));
  }
}

export function prepareLayerInspection(layer: LayerDataset) {
  return layer.presentation !== "historical" ? load(layer) : Promise.resolve();
}
export function useLayerData(layer: LayerDataset | null, point: LonLat | null, observationIds: readonly string[] = []) {
  const [state, setState] = useState<{
    id: string;
    sample?: Sampler;
    error?: string;
  }>();
  useEffect(() => {
    if (!layer || layer.presentation === "historical") return;
    let alive = true;
    load(layer)
      .then((sample) => {
        if (alive) setState({ id: layer.id, sample });
      })
      .catch((error) => {
        if (alive) setState({ id: layer.id, error: String(error) });
      });
    return () => {
      alive = false;
    };
  }, [layer]);
  const sample = state?.id === layer?.id ? state?.sample : undefined;
  const error = layer && state?.id === layer.id ? state?.error : undefined;
  const value = sample && point ? sample(point, observationIds) : null;
  return {
    loading: layer && layer.presentation !== "historical" && !sample && !error,
    error,
    value: typeof value === "number" ? value : null,
    unit: typeof value === "object" && !Array.isArray(value) ? value : null,
    observations: Array.isArray(value) ? value : [],
    covered: layer?.presentation === "historical" && point ? historicalCoverage(point) : undefined,
  };
}
