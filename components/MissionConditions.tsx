"use client";

import { useRef, useState } from "react";
import { solarClock, solarProvenance } from "@/lib/marsSolar";
import { coordinateLabel, type LonLat } from "@/lib/mars";
import type { MissionAssumptions } from "@/lib/missionPlan";
import type { MissionContext } from "@/lib/routeProtocol";
import { visibilityMethod, type Visibility } from "@/lib/terrainVisibility";
import Accordion from "./Accordion";
import EvidenceLink from "./EvidenceLink";

export const visibilityColors = { clear: "#8cdfbd", obstructed: "#f2bb90", unknown: "#b4afdc" } as const;
const statusNames = { clear: "Clear", obstructed: "Obstructed", unknown: "Unknown" } as const;
const earthHours = (seconds: number) => (seconds / 3600).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " Earth h";

export function CommunicationsSetup({ mission, start, mapReady, onChange, onPlace, onRemove }: {
  mission: MissionAssumptions; start: LonLat | null; mapReady: boolean;
  onChange: (patch: Partial<MissionAssumptions>) => void; onPlace: () => void; onRemove: () => void;
}) {
  const placeButton = useRef<HTMLButtonElement>(null);
  return <Accordion title="Communications assumptions" className="quality-details">
    <p className="small-note">{mission.station ? coordinateLabel(mission.station) : "Choose a hypothetical station."}</p>
    <div className="mission-presets">
      <button className="secondary-button" disabled={!start} onClick={() => onChange({ station: start })}>Use A as station</button>
      <button ref={placeButton} className="secondary-button" disabled={!mapReady} onClick={onPlace}>Place station on map</button>
    </div>
    {mission.station && <button className="text-button" onClick={() => {
      placeButton.current?.focus({ preventScroll: true });
      onRemove();
    }}>Clear station</button>}
    <div className="mission-fields">
      {(["stationHeightM", "observerHeightM"] as const).map((id) => <label key={id}>
        {id === "stationHeightM" ? "Station antenna height (m)" : "Observer antenna height (m)"}
        <input type="number" min="0" step="any" value={mission[id] ?? ""}
          aria-invalid={mission[id] !== null && mission[id]! < 0 || undefined}
          onChange={(event) => onChange({ [id]: event.target.value === "" ? null : event.target.valueAsNumber })} />
      </label>)}
    </div>
    <p className="small-note">Heights are measured above the DTM surface. The result describes geometric visibility.</p>
  </Accordion>;
}

export function MissionConditions({ context, pending, terminator, onTerminator, visibility, onVisibility, onProfile }: {
  context?: MissionContext; pending: boolean; terminator: boolean; onTerminator: (visible: boolean) => void;
  visibility: boolean; onVisibility: (visible: boolean) => void; onProfile: (point: LonLat | null) => void;
}) {
  const [position, setPosition] = useState(0);
  const solar = context?.daylight;
  const timeline = solar?.timeline;
  const active = timeline?.samples[Math.min(position, timeline.samples.length - 1)];
  const report = context?.visibility;
  return <>
    <Accordion className="quality-details mission-daylight" title="Daylight & departure">
      {pending && <p role="status" className="small-note">Calculating mission conditions…</p>}
      {solar?.start && <dl className="route-evidence-metrics">
        <div><dt>Departure</dt><dd>{solar.departureUtc}</dd></div>
        <div><dt>Season</dt><dd className="mission-measure">Ls {solar.ls.toFixed(1)}°</dd></div>
        <div><dt>Start local time</dt><dd className="mission-readout-group"><span className="mission-measure">{solarClock(solar.start.meanTime)} LMST</span>{" "}<span className="mission-measure">{solarClock(solar.start.trueTime)} LTST</span></dd></div>
        <div><dt>Solar elevation</dt><dd className="mission-measure">{solar.start.elevation.toFixed(1)}°</dd></div>
        <div><dt>Azimuth from north</dt><dd className="mission-measure">{solar.start.azimuth === null ? "Undefined" : solar.start.azimuth.toFixed(1) + "°"}</dd></div>
        <div><dt>Geometric horizon at A</dt><dd>{solar.window.status === "crossings"
          ? `${solarClock(solar.window.sunriseLtst)} sunrise · ${solarClock(solar.window.sunsetLtst)} sunset LTST`
          : solar.window.status === "polar-day" ? "Continuous daylight" : "Continuous darkness"}</dd></div>
      </dl>}
      {solar?.terminator && <label className="mission-check">
        <input type="checkbox" checked={terminator} onChange={(event) => onTerminator(event.target.checked)} />Show solar terminator
      </label>}
      {timeline && <div className="daylight-profile">
        <p><strong>{earthHours(timeline.daylightSeconds)} in geometric daylight</strong> of {earthHours(timeline.durationSeconds)} travel and dwell time.</p>
        <svg className="daylight-chart" viewBox="0 0 320 96" role="img" aria-label="Solar elevation along the journey. The dotted horizontal line is the geometric horizon.">
          <line x1="0" x2="320" y1="48" y2="48" stroke="#a5b8ad" strokeDasharray="4 5" />
          <polyline fill="none" stroke="#f6bc8c" strokeWidth="2" points={timeline.samples.map(({ seconds, elevation }) =>
            `${(seconds / timeline.durationSeconds * 320).toFixed(2)},${(48 - elevation / 90 * 46).toFixed(2)}`).join(" ")} />
          {active && <circle cx={active.seconds / timeline.durationSeconds * 320} cy={48-active.elevation/90*46} r="4" fill="#86ddc5" />}
        </svg>
        <label>Inspect daylight on map
          <input type="range" min="0" max={timeline.samples.length - 1} value={Math.min(position, timeline.samples.length - 1)}
            onChange={(event) => { const i = +event.target.value; setPosition(i); onProfile(timeline.samples[i].position); }}
            onBlur={() => onProfile(null)} />
        </label>
        {active && <p className="small-note">{earthHours(active.seconds)} elapsed · {active.phase} · {active.dwell ? "stop dwell · " : ""}{active.elevation.toFixed(1)}° solar elevation</p>}
        {!!solar.alternateDepartures?.length && <ul className="mission-alternates">
          {solar.alternateDepartures.map((trial) => <li key={trial.offsetHours}>
            {trial.offsetHours < 0 ? "One Earth hour earlier" : "One Earth hour later"} · {earthHours(trial.daylightSeconds)} in daylight
          </li>)}
        </ul>}
      </div>}
      {(solar?.reason || context?.error || (!solar && !pending)) && <p className="small-note">{context?.error ?? solar?.reason ?? "Set an Earth UTC departure."}</p>}
      <p className="small-note">{solarProvenance.limitation} Times at the horizon use the departure season.</p>
      <EvidenceLink className="text-link" href={solarProvenance.source} target="_blank" rel="noreferrer">NASA Mars24 method</EvidenceLink>
    </Accordion>
    <Accordion className="quality-details mission-visibility" title="Terrain line of sight">
      {report?.outbound ? <>
        <label className="mission-check"><input type="checkbox" checked={visibility}
          onChange={(event) => onVisibility(event.target.checked)} />Show visibility samples on map</label>
        {[["Outbound", report.outbound], ["Return", report.return]].map(([label, record]) => {
          if (!record || typeof record === "string") return null;
          return <div className="visibility-leg" key={label as string}>
            <strong>{label as string}</strong>
            <p className="small-note">{record.samples.length} samples · {record.spacingM.toFixed(1)} m spacing · {Number(record.resolutionM.toFixed(2))} m DTM</p>
            <ul className="categorical-legend">{(Object.keys(statusNames) as Visibility[]).map((status) =>
              <li key={status}><i style={{ backgroundColor: visibilityColors[status] }} />
                {statusNames[status]} · {record.samples.filter((sample) => sample.status === status).length}</li>
            )}</ul>
          </div>;
        })}
        <EvidenceLink className="text-link" href={report.outbound.source} target="_blank" rel="noreferrer">Visibility terrain source</EvidenceLink>
      </> : <p className="small-note">{pending ? "Calculating visibility…" : context?.error ?? report?.reason ?? "Set a station and antenna heights."}</p>}
      <p className="small-note">{visibilityMethod} Missing terrain and connectors are unknown. Propagation, antenna patterns and relays remain unassessed.</p>
    </Accordion>
  </>;
}
