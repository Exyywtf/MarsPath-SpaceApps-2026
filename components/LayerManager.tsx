"use client";
import { useRef, useState } from "react";
import { Check, Gauge, Mountain, Radiation, Thermometer, Wind } from "lucide-react";
import {
  scientificLayers,
  isRadiation,
  sourceAnchor,
  type LayerId,
  type LayerDataset,
} from "@/lib/layers";
import { radiationManifest as rad, radiationProduct } from "@/lib/radiation";
import type { OverlayState } from "@/lib/scientificOverlay";
import AtlasDialog, { type DialogHandle } from "./AtlasDialog";
const icons = {
  topography: Mountain,
  temperature: Thermometer,
  pressure: Gauge,
  wind: Wind,
  radiation: Radiation,
  "radiation-historical": Radiation,
  "radiation-column": Radiation,
};
export function LayerLegend({ layer }: { layer: LayerDataset }) {
  return (
    <div className="layer-legend" aria-label={layer.name + " legend"}>
      {layer.presentation === "historical" ? (
        <div className="historical-legend" role="img" aria-label="NASA’s original spectrum from 10 to 20 rem per year" />
      ) : <div
        className="legend-gradient"
        style={{
          background:
            "linear-gradient(to right," + layer.palette.join(",") + ")",
        }}
      />}
      <div>
        <span>
          {layer.range[0].toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}{" "}
          {layer.unit}
        </span>
        <span>
          {layer.range[1].toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}{" "}
          {layer.unit}
        </span>
      </div>
    </div>
  );
}
export default function LayerManager({
  active,
  displayed,
  onActive,
  opacity,
  onOpacity,
  status,
  onRetry,
}: {
  active: LayerId | null;
  displayed: LayerDataset | null;
  onActive: (id: LayerId | null) => void;
  opacity: number;
  onOpacity: (value: number) => void;
  status: OverlayState;
  onRetry: () => void;
}) {
  const [radiationMode, setRadiationMode] = useState<LayerId>(radiationProduct);
  const reference = useRef<DialogHandle>(null);
  const radiationActive = isRadiation(active);
  const actualRadiation = isRadiation(displayed?.id ?? null);
  return (
    <section aria-labelledby="scientific-layer-title">
      <h2 className="section-heading" id="scientific-layer-title">
        Scientific overlays
      </h2>
      <p className="small-note">
        Choose a layer, then click the map to inspect the value or image coverage.
      </p>
      <div className="scientific-layers">
        {scientificLayers.filter((l) => l.presentation !== "historical").map((l) => {
          const Icon = icons[l.id];
          const radiation = isRadiation(l.id);
          const selected = radiation ? radiationActive : active === l.id;
          return (
            <button
              key={l.id}
              className={
                "scientific-layer" + (selected ? " chosen" : "")
              }
              aria-pressed={selected}
              onClick={() => onActive(selected ? null : radiation ? radiationMode : l.id)}
            >
              <Icon size={20} />
              <span>
                <strong>{radiation ? "Radiation" : l.name}</strong>
                <small>
                  {radiation ? "Model and historical illustration" : l.kind + " · " + l.unit}
                </small>
              </span>
              {selected ? (
                <Check size={18} />
              ) : (
                <span
                  className="layer-preview"
                  style={{
                    background:
                      "linear-gradient(to top," + l.palette.join(",") + ")",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
      {(active || displayed) && (
        <div className="layer-information" data-hiding={status.phase === "hiding"} inert={status.phase === "hiding"}>
          {radiationActive && (
            <label className="radiation-mode">
              Radiation view
              <select value={radiationMode} onChange={(e) => {
                const id = e.target.value as LayerId;
                setRadiationMode(id);
                onActive(id);
              }}>
                <option value={radiationProduct}>{radiationProduct === "radiation" ? "Modelled cosmic rays" : "Atmospheric shielding proxy"}</option>
                <option value="radiation-historical">NASA historical map · 2002</option>
              </select>
            </label>
          )}
          <label className="slider-label">
            Layer opacity<span>{Math.round(opacity * 100)}%</span>
            <input
              type="range"
              aria-label="Scientific layer opacity"
              min="0"
              max="1"
              step=".05"
              value={opacity}
              onChange={(e) => onOpacity(+e.target.value)}
            />
          </label>
          <p role="status" className="small-note">
            {status.message}
            {status.phase === "error" && displayed && " Showing " + displayed.name + "."}
          </p>
          {status.phase === "error" && <button className="secondary-button" onClick={onRetry}>Retry overlay</button>}
          {displayed && <LayerDetails key={displayed.id} layer={displayed} radiation={actualRadiation} />}
          {radiationActive && <>
            <button className="secondary-button full-width" onClick={(event) => reference.current?.open(event.currentTarget)}>View NASA original</button>
            <AtlasDialog ref={reference} id="radiation-reference-title" title="Estimated Radiation Dosage on Mars" closeLabel="Close NASA illustration" wide>
              {/* The reference must preserve the supplied frame and legend byte for byte. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={rad.historical.originalUrl} alt="NASA’s 2002 illustration of two Mars globes, with a 10 to 20 rem per year dose-equivalent scale." width="3000" height="2400" loading="lazy" />
              <p>{rad.historical.credit} · PIA03480 · March 2002</p>
              <a className="text-link" href={rad.historical.source} target="_blank" rel="noreferrer">Original caption and credit ↗</a>
            </AtlasDialog>
          </>}
        </div>
      )}
      <details className="quality-details">
        <summary>Radiation observations & minerals</summary>
        <p>
          Curiosity measured radiation along its traverse in Gale Crater.
          Those local observations cannot supply global radiation values.
          The reprojected historical map uses NASA’s original PIA03480.
        </p>
        <a
          className="text-link"
          href="https://science.nasa.gov/resource/radiation-measurements-on-mars/"
          target="_blank"
          rel="noreferrer"
        >
          Curiosity radiation observations ↗
        </a>
        <p>Explore destination sources for orbital evidence of minerals.</p>
        <a className="text-link" href="/sources/#nili">
          Mineral evidence at Nili Fossae ↗
        </a>
      </details>
    </section>
  );
}

function LayerDetails({ layer, radiation }: { layer: LayerDataset; radiation: boolean }) {
  return (
    <div className="layer-details">
          <LayerLegend layer={layer} />
          <p>{layer.context}</p>
          <dl>
            <dt>Sampling</dt>
            <dd>{layer.sampling}</dd>
            <dt>Native resolution</dt>
            <dd>{layer.nativeResolution}</dd>
            {radiation && <>
              <dt>Map coverage</dt>
              <dd>{(100 * (layer.presentation === "historical" ? rad.historical.coverage :
                layer.id === "radiation-column" ? rad.proxyCoverage : rad.modelCoverage)).toFixed(1)}% of Mars by area</dd>
            </>}
          </dl>
          <p className="small-note">
            {layer.id === "topography"
              ? "Averaged MOLA elevations. Interpolation does not restore native terrain detail."
              : layer.presentation === "historical"
                ? "Historical artwork; point inspection reports image coverage only. No raster colours are converted to dose."
                : layer.id === "radiation"
                  ? "Interpolated at six simulated pressures. Largest withheld-pressure error: about 2.5 mSv/year. Absolute surface accuracy is unknown."
                  : layer.id === "radiation-column" ? "This shows how much atmosphere sits above a point."
                    : "Model means, not current weather or extreme conditions. Export sampling is not the native climate-model resolution."}
          </p>
          <a
            className="text-link"
            href={layer.sourcePage}
            target="_blank"
            rel="noreferrer"
          >
            Dataset source ↗
          </a>
          <a
            className="text-link"
            href={"/sources/#" + sourceAnchor(layer.id)}
          >
            Processing, credits & limitations ↗
          </a>
    </div>
  );
}
