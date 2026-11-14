"use client";
import { useEffect, useState } from "react";
import { loadClimate, sampleGrid, type LayerDataset } from "./layers";
import type { LonLat } from "./mars";
import { historicalCoverage, loadRadiationPressure, sampleColumn, sampleRadiation } from "./radiation";
import { sampleClimate } from "./routeAnalysis";
type Sampler = (point: LonLat) => number | null;
const samplers = new Map<string, Promise<Sampler>>();
function load(layer: Extract<LayerDataset, { presentation: "numerical" }>): Promise<Sampler> {
  const id = layer.id;
  if (samplers.has(id)) return samplers.get(id)!;
  const pending =
    id === "topography"
      ? fetch(layer.dataUrl).then(async (r) => {
          if (!r.ok) throw new Error("Elevation download failed.");
          const values = new Float32Array(await r.arrayBuffer());
          return (point: LonLat) => sampleGrid(values, 1440, 720, point, false);
        })
      : id === "radiation" || id === "radiation-column"
        ? loadRadiationPressure().then((grid) => (point: LonLat) =>
            (id === "radiation" ? sampleRadiation : sampleColumn)(grid, point))
        : loadClimate().then((data) => (point: LonLat) => sampleClimate(data,id,point));
  samplers.set(id, pending);
  pending.catch(() => samplers.delete(id));
  return pending;
}

export function prepareLayerInspection(layer: LayerDataset) {
  return layer.presentation === "numerical" ? load(layer) : Promise.resolve();
}
export function useLayerData(layer: LayerDataset | null, point: LonLat | null) {
  const [state, setState] = useState<{
    id: string;
    sample?: Sampler;
    error?: string;
  }>();
  useEffect(() => {
    if (layer?.presentation !== "numerical") return;
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
  return {
    loading: layer?.presentation === "numerical" && !sample && !error,
    error,
    value: sample && point ? sample(point) : null,
    covered: layer?.presentation === "historical" && point ? historicalCoverage(point) : undefined,
  };
}
