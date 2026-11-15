"use client";

import type { ReactNode } from "react";
import { asLonLat, locations } from "@/lib/atlas";
import { coordinateLabel } from "@/lib/mars";
import { missionObjectives, missionTiming, type MissionAssumptions, type MissionObjective, type MissionReturn } from "@/lib/missionPlan";
import { formatDistance, type PlannerDraft, type PlannedRoute } from "@/lib/planner";
import independent from "@/data/validation/v5-jezero.json";
import jezero from "@/public/processed/jezero.json";
import { scienceTargets } from "@/lib/science";
import type { Ranking } from "@/lib/routeRanking";
import Accordion from "./Accordion";
import EvidenceLink from "./EvidenceLink";
import StyledSelect from "./StyledSelect";

export const missionPresets = {
  balanced: { name: "Balanced", distanceWeight: 35, terrainWeight: 45, scienceWeight: 20 },
  shortest: { name: "Shortest", distanceWeight: 100, terrainWeight: 0, scienceWeight: 0 },
  gentler: { name: "Gentler terrain", distanceWeight: 0, terrainWeight: 100, scienceWeight: 0 },
  science: { name: "Science first", distanceWeight: 0, terrainWeight: 0, scienceWeight: 100 },
} as const;
export type MissionPreset = keyof typeof missionPresets;

const objectiveNotes: Partial<Record<MissionObjective, [string, string]>> = {
  "ancient-water": ["Published Jezero delta outcrop cells can contribute to the local science score.", "/sources/#jezero-photogeology"],
  sedimentary: ["Published Jezero delta outcrop cells can contribute to the local science score.", "/sources/#jezero-photogeology"],
  clay: ["The mineral catalogues provide mapped context for clay research, with zero route weight.", "/sources/#minerals"],
  carbonate: ["Jezero’s mapped units and destination sources provide carbonate research context.", "/sources/#jezero"],
  ice: ["The SWIM depth grids are unavailable. Ice remains a source reference.", "/sources/#swim"],
  volcanic: ["The mapped units and Olympus Mons sources provide volcanic context.", "/sources/#olympus"],
  destination: ["Destination cards describe the evidence and terrain available at each location.", "/?place=jezero"],
};

export function MissionSetup({ mission, draft, onChange, onDraft, onObjective, onExample, showStudy, onStudy, communications }: {
  mission: MissionAssumptions; draft: PlannerDraft;
  onChange: (patch: Partial<MissionAssumptions>) => void; onDraft: (draft: PlannerDraft) => void;
  onObjective: (objective: MissionObjective) => void; onExample: () => void;
  showStudy: boolean; onStudy: (open: boolean) => void;
  communications?: ReactNode;
}) {
  const note = objectiveNotes[mission.objective];
  const speedInvalid = mission.speedKmh !== null && mission.speedKmh <= 0;
  const dwellInvalid = mission.dwellMinutes !== null && mission.dwellMinutes < 0;
  return <section className="mission-setup" aria-label="Mission setup">
    <button className="primary-button" onClick={onExample}>Try validated mission example</button>
    <Accordion title="Validated Case Study" className="quality-details" open={showStudy} onOpenChange={onStudy}>
      <p>Compare routes across the Jezero delta on the 20 m CTX elevation grid. The example adds an optional published outcrop and a direct return search.</p>
      <p className="small-note">Independent Python Dijkstra reproduced four outbound candidates and the separate return.
        The Science first preset recommends the route through the curvilinear delta outcrop.</p>
      <EvidenceLink className="text-link" href="/methodology/#mission-validation">Case inputs, checks and limits</EvidenceLink>
      <EvidenceLink className="text-link" href="https://science.nasa.gov/mission/mars-2020-perseverance/location-map/" target="_blank" rel="noreferrer">Perseverance traverse context</EvidenceLink>
    </Accordion>
    <div className="mission-fields">
      <label>Mission name<input value={mission.name} maxLength={90} onChange={(event) => onChange({ name: event.target.value })} /></label>
      <label>Research objective
        <StyledSelect value={mission.objective} onChange={(event) => onObjective(event.target.value as MissionObjective)}>
          {missionObjectives.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </StyledSelect>
      </label>
      {mission.objective === "custom" && <label>Objective description
        <input value={mission.customObjective} maxLength={160} onChange={(event) => onChange({ customObjective: event.target.value })} />
      </label>}
    </div>
    {note && <p className="small-note">{note[0]} <EvidenceLink href={note[1]}>Source</EvidenceLink></p>}
    <Accordion title="Choose endpoints from destinations" className="quality-details">
      <div className="mission-fields">
        {(["start", "end"] as const).map((side) => <label key={side}>
          {side === "start" ? "Start destination (A)" : "End destination (B)"}
          <StyledSelect value={locations.find((place) => draft[side]?.[0] === place.coordinates[0] && draft[side]?.[1] === place.coordinates[1])?.id ?? ""}
            onChange={(event) => {
              const target = locations.find(({ id }) => id === event.target.value);
              if (target) onDraft({ ...draft, [side]: asLonLat(target.coordinates) });
            }}>
            <option value="" disabled>Choose a destination</option>
            {locations.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
          </StyledSelect>
        </label>)}
      </div>
    </Accordion>
    <Accordion title="Travel assumptions" className="quality-details" defaultOpen>
      <div className="mission-fields">
        <label>Speed (km/h)<input type="number" min="0.01" step="any" value={mission.speedKmh ?? ""}
          aria-invalid={speedInvalid || undefined} aria-describedby={speedInvalid ? "mission-speed-error" : undefined}
          onChange={(event) => onChange({ speedKmh: event.target.value === "" ? null : event.target.valueAsNumber })} /></label>
        <label>Minutes per outbound stop<input type="number" min="0" step="any" value={mission.dwellMinutes ?? ""}
          aria-invalid={dwellInvalid || undefined} aria-describedby={dwellInvalid ? "mission-dwell-error" : undefined}
          onChange={(event) => onChange({ dwellMinutes: event.target.value === "" ? null : event.target.valueAsNumber })} /></label>
        <label className="mission-wide">Departure (Earth UTC)
          <input type="datetime-local" value={mission.departure} onChange={(event) => onChange({ departure: event.target.value })} />
        </label>
      </div>
      {speedInvalid && <p className="data-note" id="mission-speed-error">Enter a speed greater than zero.</p>}
      {dwellInvalid && <p className="data-note" id="mission-dwell-error">Enter a stop duration of zero or more minutes.</p>}
      <p className="small-note">Illustrative constant-speed schedule. Blank dwell time adds zero minutes per stop.</p>
    </Accordion>
    <label className="mission-check">
      <input type="checkbox" checked={mission.returnMode !== null}
        onChange={(event) => onChange({ returnMode: event.target.checked ? "terrain" : null })} />
      Return to base
    </label>
    {mission.returnMode && <p className="small-note">Search from B directly to A. Required waypoints and research stops apply to the outbound leg.</p>}
    {communications}
  </section>;
}

export function MissionJourney({ mission, outbound, inbound, onChange, revision }: {
  mission: MissionAssumptions; outbound: PlannedRoute; inbound?: MissionReturn;
  onChange: (patch: Partial<MissionAssumptions>) => void; revision?: string;
}) {
  const back = inbound?.status === "ready" ? inbound.route : undefined;
  const complete = !mission.returnMode || !!back;
  const timing = missionTiming(outbound, back, mission);
  const time = timing.elapsedSeconds;
  const leg = (route: PlannedRoute, name: string, detail?: string) => <div>
    <dt>{name}</dt>
    <dd><strong>{formatDistance(route.distance)}</strong>
      <small>{detail ?? route.name} · {route.tier} planning</small>
      {route.terrain && <small>↑ {formatDistance(route.terrain.ascent)} · ↓ {formatDistance(route.terrain.descent)} · {formatDistance(route.distance - route.assessedDistance)} connectors</small>}
    </dd>
  </div>;
  return <section className="mission-journey" aria-label="Mission journey" data-request={revision}>
    <h2>{mission.name || "Mission journey"}</h2>
    <dl>
      {leg(outbound, "Outbound · A to B")}
      {back && leg(back, "Return · B to A")}
      {back && <div><dt>Round-trip distance</dt><dd><strong>{formatDistance(timing.distanceM)}</strong></dd></div>}
      {time !== undefined && <div><dt>{complete && back ? "Estimated round-trip duration" : "Estimated outbound duration"}</dt>
        <dd><strong>{(time / 3600).toLocaleString(undefined, { maximumFractionDigits: 2 })} Earth hours</strong>
          <small>{timing.stopCount} outbound {timing.stopCount === 1 ? "stop" : "stops"} · {timing.dwellSeconds! / 60} min dwell</small></dd></div>}
    </dl>
    <p className="small-note">
      {formatDistance(outbound.assessedDistance + (back?.assessedDistance ?? 0))} assessed terrain ·
      {" "}{outbound.tier === "geographic" ? "geographic distance only" : "alignment accuracy and rock-scale hazards are unresolved"}
    </p>
    {mission.returnMode && !back && <p role="status" className="small-note">
      {inbound?.status === "unavailable" ? inbound.reason : "Calculating the independent return leg…"}
    </p>}
    {inbound?.status === "unavailable" && <button className="secondary-button" onClick={() => onChange({ returnMode: "geographic" })}>
      Use a geographic return estimate
    </button>}
    {back?.tier === "geographic" && <p className="small-note">Return estimate uses great-circle distance. Return terrain is unassessed.</p>}
  </section>;
}

export function MissionSensitivity({ routes, baseline, ranking, scores, preset, onPreset }: {
  routes: PlannedRoute[]; baseline?: number[]; ranking: Ranking; scores: number[];
  preset?: MissionPreset; onPreset: (preset: MissionPreset | undefined) => void;
}) {
  const winner = Math.min(...scores);
  const tied = routes.filter((_, index) => Math.abs(scores[index] - winner) <= 1e-8);
  const previous = baseline ? routes[baseline.indexOf(Math.min(...baseline))] : undefined;
  const delta = previous && tied.length === 1 ? tied[0].distance - previous.distance : 0;
  return <Accordion title="What changes this recommendation?" className="quality-details mission-sensitivity">
    <div className="mission-presets" aria-label="Ranking presets">
      {(Object.entries(missionPresets) as [MissionPreset, typeof missionPresets[MissionPreset]][]).map(([id, option]) =>
        <button key={id} type="button" className="secondary-button" aria-pressed={preset === id}
          onClick={() => onPreset(id)}>{option.name}</button>)}
    </div>
    {preset && <button className="text-button" onClick={() => onPreset(undefined)}>Use current weights</button>}
    <p role="status" className="small-note">{tied.length > 1 ? `Tie between ${tied.map((route) => route.name).join(" and ")}.` :
      tied[0] ? `${tied[0].name} has the lowest score.${delta ? " It is " + formatDistance(Math.abs(delta)) + (delta > 0 ? " longer" : " shorter") + " than the current-settings recommendation." : ""}` : "Waiting for candidates."}</p>
    <p className="small-note">{Object.entries(ranking.weights).filter(([, value]) => value > 0)
      .map(([label, value]) => `${label} ${Math.round(100 * value)}%`).join(" · ") || "The selected factor is unavailable for these candidates."}</p>
    {Object.entries(ranking.climate).filter(([, factor]) => !factor.applied).map(([id, factor]) =>
      <p className="small-note" key={id}>{id} · {factor.reason}</p>)}
    <table className="mission-scores">
      <caption>Scores for the accepted candidates. Lower scores rank first.</caption>
      <thead><tr><th scope="col">Candidate</th><th scope="col">Score</th></tr></thead>
      <tbody>{routes.map((route, index) => <tr key={route.id}>
        <th scope="row">{route.name}<span className="mission-score-bar" aria-hidden="true">
          <i style={{ width: `${Math.min(1, Math.max(0, scores[index])) * 100}%` }} />
        </span></th>
        <td>{scores[index]?.toFixed(3)}</td>
      </tr>)}</tbody>
    </table>
  </Accordion>;
}

export function JezeroCaseEvidence() {
  const checks = [...independent.outbound, independent.return];
  const maxError = Math.max(...checks.map((check) => check.costErrorM));
  return <>
    <p>The example travels from {coordinateLabel(asLonLat(jezero.examples[0][0]))} to {coordinateLabel(asLonLat(jezero.examples[0][1]))}.</p>
    <p>Independent Python Dijkstra reproduced the four outbound costs and the direct return within {maxError.toExponential(2)} model metres.
      Every retained elevation matched the original USGS crop. The comparison establishes numerical agreement on the sampled grid.</p>
    <div className="table-scroll" role="region" aria-label="Jezero case results" tabIndex={0}>
      <table className="validation-table">
        <thead><tr><th scope="col">Candidate</th><th scope="col">Distance</th><th scope="col">Maximum slope</th><th scope="col">Published outcrop cell</th></tr></thead>
        <tbody>{checks.map((check) => <tr key={check.id}>
          <th scope="row">{check.id.startsWith("return-") ? "Direct return" : check.name}</th>
          <td>{formatDistance(check.distanceM)}</td><td>{check.maximumSlopeDegrees.toFixed(1)}°</td>
          <td>{check.targetsReached.map((id) => scienceTargets.find((target) => target.id === id)?.name).join(", ") || "None reached"}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p>20° slope limit · 20 m projected cells · λ = 4 terrain-focused search. Model cost tolerance 0.0001 m. Location accuracy and rock-scale hazards remain unresolved.</p>
    <EvidenceLink href={jezero.sourcePage} target="_blank" rel="noreferrer">USGS Jezero CTX terrain</EvidenceLink>
  </>;
}
