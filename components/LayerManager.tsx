"use client";
import EvidenceLink from "./EvidenceLink";
import StyledSelect from "./StyledSelect";
import Accordion from "./Accordion";
import { useRef, useState } from "react";
import { Check, Gem, Gauge, Layers3, Mountain, Radiation, Thermometer, Wind } from "lucide-react";
import {
  scientificLayers,
  isRadiation,
  sourceAnchor,
  type LayerId,
  type LayerDataset,
} from "@/lib/layers";
import { radiationManifest as rad, radiationProduct } from "@/lib/radiation";
import { explorationScience, mineralStyles, scienceSources } from "@/lib/explorationScience";
import type { OverlayState } from "@/lib/scientificOverlay";
import AtlasDialog, { type DialogHandle } from "./AtlasDialog";
import { terrainCoverage } from "@/lib/terrainCoverage";
const icons = {
  topography: Mountain,
  temperature: Thermometer,
  pressure: Gauge,
  wind: Wind,
  radiation: Radiation,
  "radiation-historical": Radiation,
  "radiation-column": Radiation,
  geology: Layers3,
  minerals: Gem,
  "thermal-inertia": Thermometer,
  coverage: Layers3,
};
export function LayerLegend({ layer, compact = false }: { layer: LayerDataset; compact?: boolean }) {
  if (layer.presentation === "coverage") return <ul className="categorical-legend" aria-label="Terrain coverage legend">
    <li><i style={{ backgroundColor: terrainCoverage.colors.regional }} />Regional terrain</li>
    <li><i style={{ backgroundColor: terrainCoverage.colors.coarse }} />Coarse MOLA terrain</li>
    <li><i style={{ backgroundColor: terrainCoverage.colors.missing }} />Missing numerical terrain</li>
  </ul>;
  if (layer.presentation === "observations") return (
    <ul className="categorical-legend" aria-label="Mineral observations legend">
      {Object.entries(mineralStyles).map(([type, item]) =>
        <li key={type}><i data-symbol={type} style={{ backgroundColor: item.color }} />{item.label}</li>)}
    </ul>
  );
  if (layer.presentation === "categorical") return compact
    ? <p className="small-note">44 units · full legend in Layers</p>
    : <Accordion className="quality-details" title="Geologic unit legend">
      <ul className="categorical-legend" aria-label="Global geology legend">
        {explorationScience.geology.units.map((unit) =>
          <li key={unit.code}><i style={{ backgroundColor: unit.color }} /><code>{unit.code}</code>{unit.name}</li>)}
      </ul>
    </Accordion>;
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
          {layer.id === "thermal-inertia" ? "≥" : ""}{layer.range[1].toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}{" "}
          {layer.unit}
        </span>
      </div>
    </div>
  );
}
const layerGroups = [
  { label: "Terrain", ids: ["topography", "coverage"] },
  { label: "Atmosphere", ids: ["temperature", "pressure", "wind"] },
  { label: "Radiation", ids: ["radiation", "radiation-column"] },
  { label: "Geology & minerals", ids: ["geology", "minerals"] },
  { label: "Surface properties", ids: ["thermal-inertia"] },
];

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
  const information = (active || displayed) && (
        <div className="layer-information" data-hiding={status.phase === "hiding"} inert={status.phase === "hiding"}>
          {radiationActive && (
            <label className="radiation-mode">
              Radiation view
              <StyledSelect value={radiationMode} onChange={(e) => {
                const id = e.target.value as LayerId;
                setRadiationMode(id);
                onActive(id);
              }}>
                <option value={radiationProduct}>{radiationProduct === "radiation" ? "Modelled cosmic rays" : "Atmospheric shielding proxy"}</option>
                <option value="radiation-historical">NASA historical map · 2002</option>
              </StyledSelect>
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
              <EvidenceLink className="text-link" href={rad.historical.source} target="_blank" rel="noreferrer">Original caption and credit</EvidenceLink>
            </AtlasDialog>
          </>}
        </div>
      );
  return (
    <section aria-labelledby="scientific-layer-title">
      <h2 className="section-heading" id="scientific-layer-title">
        Scientific overlays
      </h2>
      <p className="small-note">
        Choose a layer, then click the map to inspect its evidence.
      </p>
      <div className="scientific-layers">
        {layerGroups.map((group) => <div key={group.label} className="layer-group" role="group" aria-label={group.label}>
          <h3 className="layer-group-heading">{group.label}</h3>
          {scientificLayers.filter((layer) => group.ids.includes(layer.id)).map((l) => {
            const Icon = icons[l.id];
          const radiation = isRadiation(l.id);
          const selected = radiation ? radiationActive : active === l.id;
          const detailsHere = radiation ? isRadiation(active ?? displayed?.id ?? null) : (active ?? displayed?.id) === l.id;
          return (
            <div key={l.id}>
            <button
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
                  {radiation ? "Model and historical illustration" : l.kind + (l.unit ? " · " + l.unit : "")}
                </small>
              </span>
              {selected ? (
                <Check size={18} />
              ) : (
                <span
                  className="layer-preview"
                  style={{
                    background: l.presentation === "coverage" ? terrainCoverage.colors.regional
                      : l.presentation === "categorical" ? "#c5aa75"
                      : l.presentation === "observations" ? mineralStyles.crism.color
                        : "linear-gradient(to top," + l.palette.join(",") + ")",
                  }}
                />
              )}
            </button>
            {detailsHere && information}
            </div>
          );
          })}
        </div>)}
      </div>
      <Accordion className="quality-details" title={<>Radiation observations & minerals</>}>
        <p>
          Curiosity measured radiation along its traverse in Gale Crater.
          Those local observations cannot supply global radiation values.
          The reprojected historical map uses NASA’s original PIA03480.
        </p>
        <EvidenceLink
          className="text-link"
          href="https://science.nasa.gov/resource/radiation-measurements-on-mars/"
          target="_blank"
          rel="noreferrer"
        >
          Curiosity radiation observations</EvidenceLink>
        <p>Explore destination sources for orbital evidence of minerals.</p>
        <EvidenceLink className="text-link" href="/sources/#nili">
          Mineral evidence at Nili Fossae</EvidenceLink>
      </Accordion>
      <Accordion className="quality-details" title="Subsurface ice & dust references">
        <p>See the SWIM depth maps for regional ice evidence and the TES dust-cover index for spectral dust context.</p>
        <EvidenceLink className="text-link" href="/sources/#swim">SWIM coverage and product availability</EvidenceLink>
        <EvidenceLink className="text-link" href="/sources/#tes-dust">TES dust-cover product status</EvidenceLink>
      </Accordion>
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
            {(layer.id === "geology" || layer.id === "thermal-inertia") && <>
              <dt>Map coverage</dt>
              <dd>{(100 * (layer.id === "geology" ? explorationScience.geology.coverage : explorationScience.thermal.coverage)).toFixed(1)}% of Mars by area</dd>
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
                    : layer.id === "thermal-inertia" ? "Apparent thermal inertia describes a modelled thermal response and depends on surface heterogeneity. Local traction is unassessed."
                      : layer.presentation === "categorical" ? "Source polygons rasterized at cell centres. Unit membership and boundaries describe regional mapped geology."
                        : layer.presentation === "coverage" ? "A valid elevation cell may still be unusable under the selected slope limit."
                          : layer.presentation === "observations" ? "Markers locate catalogue records. Mineral interpretation and observation footprints are distinct."
                          : "Model means, not current weather or extreme conditions. Export sampling is not the native climate-model resolution."}
          </p>
          <EvidenceLink
            className="text-link"
            href={layer.sourcePage}
            target="_blank"
            rel="noreferrer"
          >
            Dataset source</EvidenceLink>
          {layer.id === "minerals" && <>
            <EvidenceLink className="text-link" href={scienceSources.minerals.chloride} target="_blank" rel="noreferrer">
              Chloride catalogue
            </EvidenceLink>
            <EvidenceLink className="text-link" href={scienceSources.hydrated.url} target="_blank" rel="noreferrer">
              NASA PDS hydrated mineral catalogue
            </EvidenceLink>
          </>}
          <EvidenceLink
            className="text-link"
            href={"/sources/#" + sourceAnchor(layer.id)}
          >
            Processing, credits & limitations</EvidenceLink>
    </div>
  );
}
