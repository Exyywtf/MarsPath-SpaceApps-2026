"use client";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { LonLat } from "@/lib/mars";
import { formatDistance, type PlannedRoute } from "@/lib/planner";
import { climateIds, factorInfo, type ClimateBand, type ClimatePreferences, type FactorId, type RouteAnalysis } from "@/lib/routeAnalysis";
import type { ClimateId } from "@/lib/layers";
import type { Ranking } from "@/lib/routeRanking";

type Metric = FactorId | "elevation" | "distance" | "ascent" | "slope";
const labels: Record<Metric, string> = {
  elevation: "Elevation", distance: "Distance", ascent: "Ascent", slope: "Maximum slope",
  ...Object.fromEntries(Object.entries(factorInfo).map(([id, value]) => [id, value.name])) as Record<FactorId, string>,
};
const number = (value: number, precision = 0) =>
  value.toLocaleString(undefined, { maximumFractionDigits: precision });
const coverage = (value: number | null) => value === null ? "No route length" : number(value * 100, 1) + "%";

export const EnvironmentalAnalysis = memo(function EnvironmentalAnalysis({
  route, alternatives, analyses, error, ranking,
}: {
  route: PlannedRoute;
  alternatives: PlannedRoute[];
  analyses?: Record<string, RouteAnalysis>;
  error?: string;
  ranking?: Ranking;
}) {
  const [metric, setMetric] = useState<Metric>("distance");
  const analysis = analyses?.[route.id];
  const choices = Object.keys(labels) as Metric[];
  function measure(other: PlannedRoute) {
    if (metric === "distance") return [other.distance, formatDistance(other.distance)] as const;
    if (metric === "ascent") return other.terrain ? [other.terrain.ascent, number(other.terrain.ascent) + " m"] as const : null;
    if (metric === "slope") return other.terrain ? [other.terrain.maxSlope, number(other.terrain.maxSlope, 1) + "°"] as const : null;
    if (metric === "elevation") return null;
    const row = analyses?.[other.id]?.factors[metric];
    const {unit,precision} = factorInfo[metric];
    return row?.mean === null || row?.mean === undefined ? null : [row.mean, number(row.mean,precision)+" "+unit] as const;
  }
  const measurements = alternatives.map((r) => ({ route: r, value: measure(r) }));
  const maximum = Math.max(1, ...measurements.map(({value}) => value?.[0] ?? 0));
  return (
    <section className="environment-analysis" aria-labelledby="environment-title">
      <h2 id="environment-title">Environmental &amp; Terrain Analysis</h2>
      {!analysis ? (
        <p className="small-note" role="status">{error || "Sampling numerical datasets along the route…"}</p>
      ) : (
        <div className="factor-grid">
          {(Object.keys(factorInfo) as FactorId[]).map((id) => {
            const factor = analysis.factors[id], info = factorInfo[id];
            return (
              <details key={id} className="factor-detail">
                <summary>
                  <span>{info.name}</span>
                  <strong>{factor.mean === null ? "Unavailable" : number(factor.mean,info.precision) + " " + info.unit}</strong>
                </summary>
                {factor.min !== null && factor.max !== null ? (
                  <p>Distance-weighted mean shown above. Sampled range {number(factor.min,info.precision)}–{number(factor.max,info.precision)} {info.unit} · {coverage(factor.coverage)} of route length.</p>
                ) : <p>{factor.reason}</p>}
                <p>{factor.scenario}</p>
                <p>{factor.resolution}. Absolute accuracy has not been established.</p>
                <p>{id === "radiation"
                  ? "Scenario context. Excluded from ranking and cumulative exposure."
                  : ranking?.climate[id]?.reason || "Scenario context. Excluded from the route score."}</p>
                <p>{factor.credit}</p>
                <p className="factor-links">
                  <a href={factor.source} target="_blank" rel="noreferrer">Source ↗</a>
                  {factor.sourceData && <a href={factor.sourceData} target="_blank" rel="noreferrer">Data ↗</a>}
                  <a href={factor.terms} target="_blank" rel="noreferrer">Terms ↗</a>
                </p>
              </details>
            );
          })}
        </div>
      )}
      {alternatives.length > 1 && (
        <details className="quality-details">
          <summary>Compare a metric</summary>
          <label className="analysis-select">Comparison metric
            <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
              {choices.filter((id) => id !== "elevation").map((id) => <option key={id} value={id}>{labels[id]}{id in factorInfo ? " · mean" : ""}</option>)}
            </select>
          </label>
          <ul className="metric-comparison">
            {measurements.map(({route: other,value}) => (
              <li key={other.id}>
                <span>{other.name}</span>
                <strong>{value?.[1] ?? "Unavailable"}</strong>
                {value && <div aria-hidden="true"><span style={{ width: Math.min(100,value[0]*100/maximum)+"%" }} /></div>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
});

type Point = { distance: number; value: number | null; coordinates: LonLat; connector?: boolean };
type Track = FactorId | "elevation";
const empty: Point[] = [];

function reducePoints(points: Point[]) {
  if (points.length < 200) return points;
  const indices = new Set([0,points.length-1]), step = Math.ceil(points.length/100);
  let previousMissing = points[0].value === null;
  for (let start=0; start<points.length; start+=step) {
    let low: number | undefined, high: number | undefined;
    for (let i=start; i<Math.min(points.length,start+step); i++) {
      const value = points[i].value, missing = value === null;
      if (missing !== previousMissing) {
        indices.add(i);
        if (i) indices.add(i-1);
        previousMissing = missing;
      }
      if (value === null) continue;
      if (low === undefined || value < points[low].value!) low = i;
      if (high === undefined || value > points[high].value!) high = i;
    }
    if (low !== undefined) indices.add(low);
    if (high !== undefined) indices.add(high);
  }
  return [...indices].sort((a,b) => a-b).map((i) => points[i]);
}

export const RouteProfile = memo(function RouteProfile({
  route, analysis, color, onPoint,
}: {
  route: PlannedRoute;
  analysis?: RouteAnalysis;
  color: string;
  onPoint: (point: LonLat | null) => void;
}) {
  const [track, setTrack] = useState<Track>(route.terrain ? "elevation" : "temperature");
  const [index, setIndex] = useState<number | null>(null);
  const frame = useRef(0);
  const profile = useMemo<Point[]>(() => {
    if (track === "elevation")
      return route.terrain?.profile.map(({distance,elevation},i) => ({
        distance, value: elevation, coordinates: route.coordinates[i],
      })) ?? empty;
    return analysis?.samples.map((sample) => ({
      value: sample.values[track], distance: sample.distance, coordinates: sample.point,
      connector: sample.role === "connector",
    })) ?? empty;
  }, [route, analysis, track]);
  const precision = track === "elevation" ? 0 : factorInfo[track].precision;
  const unit = track === "elevation" ? "m above datum" : factorInfo[track].unit;
  const length = (track === "elevation" ? route.assessedDistance : analysis?.distance) || 1;
  const plot = useMemo(() => {
    const increment = track === "elevation" ? 5 : precision ? .1 : 1;
    const displayed = profile.map((p) => {
      if (p.value === null) return p;
      const value = Math.round(p.value/increment)*increment;
      return { ...p, value };
    });
    let lowest = Infinity, highest = -Infinity;
    for (const { value } of displayed) {
      if (value === null) continue;
      lowest = Math.min(lowest, value);
      highest = Math.max(highest, value);
    }
    if (!Number.isFinite(lowest)) return null;
    const flat = lowest === highest;
    const min = flat ? lowest-increment : lowest;
    const max = flat ? highest+increment : highest;
    const x = (distance: number) => 69 + distance/length*509;
    const y = (value: number) => 143-(value-min)/(max-min)*120;
    let path = "", drawing = false;
    const isolated = [];
    const points = reducePoints(displayed);
    for (const [i, point] of points.entries()) {
      if (point.value === null) { drawing = false; continue; }
      if (points[i-1]?.value == null && points[i+1]?.value == null) isolated.push([x(point.distance),y(point.value)]);
      path += (drawing ? " L " : " M ") + x(point.distance) + "," + y(point.value);
      drawing = true;
    }
    if (profile.length === 1 && path) path = "M 69,"+ y(displayed[0].value!)+" H 578";
    return { path, x, y, min, max, isolated, displayed };
  }, [profile,precision,length,track]);
  const current = index === null ? undefined : profile[index];
  const currentPlotted = index === null ? undefined : plot?.displayed[index];
  function select(i: number | null) {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      setIndex(i);
      onPoint(i === null ? null : profile[i]?.coordinates ?? null);
    });
  }
  useEffect(() => () => {
    cancelAnimationFrame(frame.current);
    onPoint(null);
  }, [onPoint]);
  const display = current ? formatDistance(current.distance) + " · " +
    (current.value === null ? "No sample" : number(current.value,precision)+" "+unit) +
    (current.connector ? " · Unassessed terrain connector" : "") : "Hover or use the slider";
  return (
    <div className="profile-chart">
      <label className="analysis-select">Route profile
        <select value={track} onChange={(e) => {
          cancelAnimationFrame(frame.current);
          setIndex(null); onPoint(null); setTrack(e.target.value as Track);
        }}>
          {route.terrain && <option value="elevation">Elevation</option>}
          {(Object.keys(factorInfo) as FactorId[]).map((id) => <option key={id} value={id}>{labels[id]}</option>)}
        </select>
      </label>
      <div className="profile-frame">
      {plot ? <div className="profile-plot" key={track}>
        <div className="profile-units">{labels[track]} · {unit}</div>
        <svg viewBox="0 0 600 180" role="img" aria-label={labels[track]+" profile along route"}
          onPointerMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const distance = Math.max(0, Math.min(1, (((e.clientX-box.left)/box.width)*600-69)/509))*length;
            let low=0, high=profile.length-1;
            while (low<high) {
              const middle = (low+high) >>> 1;
              if (profile[middle].distance<distance) low=middle+1; else high=middle;
            }
            if (low > 0 && Math.abs(profile[low-1].distance-distance)<Math.abs(profile[low].distance-distance)) low--;
            select(low);
          }} onPointerLeave={() => select(null)}>
          {[plot.max, (plot.min+plot.max)/2, plot.min].map((value) => (
            <g key={value}>
              <line x1="69" x2="578" y1={plot.y(value)} y2={plot.y(value)} stroke="#46534d" />
              <text x="62" y={plot.y(value)+7} textAnchor="end" fill="#cdd6cd" fontSize="22">{number(value,precision)}</text>
            </g>
          ))}
          <path d={plot.path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {plot.isolated.map(([x,y]) => <circle key={x} cx={x} cy={y} r="4" fill={color} />)}
          <text x="69" y="174" fill="#cdd6cd" fontSize="22">0</text>
          <text x="578" y="174" textAnchor="end" fill="#cdd6cd" fontSize="22">{formatDistance(length)}</text>
          {currentPlotted && <g>
            <line x1={plot.x(currentPlotted.distance)} x2={plot.x(currentPlotted.distance)} y1="20" y2="143" stroke="#fff1dc" strokeDasharray="4 4" />
            {currentPlotted.value !== null && <circle cx={plot.x(currentPlotted.distance)} cy={plot.y(currentPlotted.value)} r="5" fill="#fff1dc" />}
          </g>}
        </svg>
        <label className="profile-scrubber">Inspect profile <span>{display}</span>
          <input type="range" aria-label={"Inspect "+labels[track].toLowerCase()+" along route"} min="0" max={profile.length-1}
            value={index ?? 0} onChange={(e) => select(+e.target.value)} onBlur={() => select(null)}
            aria-valuetext={current ? labels[track].toLowerCase() + " · " + display : undefined} />
        </label>
      </div> : <p key={track} className="small-note profile-unavailable">{analysis && track !== "elevation" ? analysis.factors[track].reason : "Numerical profile unavailable while route sampling is pending."}</p>}
      </div>
    </div>
  );
});

export function ClimatePreferenceForm({
  value, onChange, ranking, pending,
}: {
  value: ClimatePreferences;
  onChange: (value: ClimatePreferences) => void;
  ranking?: Ranking;
  pending: boolean;
}) {
  const [message,setMessage] = useState("");
  return (
    <details className="quality-details climate-preferences">
      <summary>Climate preferences</summary>
      <label className="layer-toggle">
        <span>Use climate preferences</span>
        <input type="checkbox" checked={value.enabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />
      </label>
      <p className="small-note">Explore preferences for the fixed MCD snapshot. These settings only rank existing terrain candidates.</p>
      {value.enabled && (
        <form onSubmit={(e) => {
          e.preventDefault();
          const input = new FormData(e.currentTarget), bands: ClimatePreferences["bands"] = {};
          for (const id of climateIds) {
            const minText = String(input.get(id+"-min") ?? ""), maxText = String(input.get(id+"-max") ?? "");
            if (!minText && !maxText) continue;
            const min = minText ? Number(minText) : undefined, max = Number(maxText);
            if (!maxText || (id !== "wind" && min === undefined) || !Number.isFinite(max) || max < 0 ||
              (min !== undefined && (!Number.isFinite(min) || min < 0 || min > max))) {
              setMessage(factorInfo[id].name + " requires an ordered, nonnegative " + (id === "wind" ? "ceiling." : "minimum and maximum."));
              return;
            }
            bands[id] = { min, max } satisfies ClimateBand;
          }
          onChange({ enabled: true, weight: Number(input.get("climate-weight")), bands });
          setMessage(Object.keys(bands).length ? "Preferences applied." : "Enter a band or a wind ceiling to compare routes.");
        }}>
          {climateIds.map((id) => (
            <fieldset key={id}>
              <legend>{factorInfo[id].name} ({factorInfo[id].unit})</legend>
              <div className="coordinate-fields">
                {id !== "wind" && (
                  <label>Minimum<input name={id+"-min"} aria-label={id+" minimum"} type="number" min="0" step="any" defaultValue={value.bands[id]?.min} /></label>
                )}
                <label>{id === "wind" ? "Ceiling" : "Maximum"}
                  <input name={id+"-max"} aria-label={id+(id === "wind" ? " ceiling" : " maximum")} type="number" min="0" step="any" defaultValue={value.bands[id]?.max} />
                </label>
              </div>
            </fieldset>
          ))}
          <label>Climate weight (%)<input name="climate-weight" aria-label="Climate preference weight" type="number" min="0" max="100" step="1" required defaultValue={value.weight} /></label>
          <button className="secondary-button full-width">Apply climate preferences</button>
          {message && <p className="small-note" role="status">{message}</p>}
          {pending && <p className="small-note" role="status">Checking model coverage for this comparison…</p>}
          {ranking && climateIds.filter((id) => ranking.climate[id]).map((id: ClimateId) => (
            <p key={id} className="small-note">{factorInfo[id].name} · {ranking.climate[id]?.reason}</p>
          ))}
        </form>
      )}
    </details>
  );
}
