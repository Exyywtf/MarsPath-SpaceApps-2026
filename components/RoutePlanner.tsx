"use client";
import { memo, useMemo, useState } from "react";
import {
  ArrowDownUp,
  Crosshair,
  Download,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import metadata from "@/public/processed/jezero.json";
import validation from "@/data/validation/v2-independent.json";
import ScienceObjectives from "./ScienceObjectives";
import { localObjectives, scienceTargets } from "@/lib/science";
import { coordinateLabel, type LonLat } from "@/lib/mars";
import {
  formatDistance,
  parseCoordinate,
  routeAppearance,
  splitDateLine,
  type PlannerDraft,
  type PlannerSettings,
  type PlannerResult,
  type Placement,
  type PlannedRoute,
} from "@/lib/planner";
export const terrainMetadata = metadata;
const noRoutes: PlannedRoute[] = [];
interface Props {
  draft: PlannerDraft;
  mapReady: boolean;
  settings: PlannerSettings;
  onDraft: (draft: PlannerDraft) => void;
  onSettings: (settings: PlannerSettings) => void;
  placement: Placement;
  onPlacement: (p: Placement) => void;
  result?: PlannerResult;
  collapsed: boolean;
  onEdit: () => void;
  pending: boolean;
  error?: string;
  active: number;
  recommended: number;
  onActive: (index: number) => void;
  onRecalculate: () => void;
  onExample: () => void;
  onFit: () => void;
  onProfile: (point: LonLat | null) => void;
  onExploreGoal: (tag: string) => void;
}
function compareTerrainCandidates(
  shortest?: PlannedRoute,
  lower?: PlannedRoute,
) {
  if (!shortest?.terrain || !lower?.terrain) return "";
  const a = shortest.terrain,
    b = lower.terrain;
  if (
    a.cells.length === b.cells.length &&
    a.cells.every((cell, index) => cell === b.cells[index])
  ) {
    return "The shortest and terrain-focused candidates follow the same assessed path.";
  }
  const extraDistance = lower.distance - shortest.distance,
    change = b.riskIntegral - a.riskIntegral;
  const distance =
    Math.abs(extraDistance) < 0.5
      ? "has the same rounded length"
      : "is " +
        formatDistance(Math.abs(extraDistance)) +
        (extraDistance > 0 ? " longer" : " shorter");
  const penalty =
    Math.abs(change) < 1e-6
      ? "the same integrated terrain penalty"
      : a.riskIntegral > 0
        ? ((Math.abs(change) / a.riskIntegral) * 100).toFixed(1) +
          "% " +
          (change < 0 ? "lower" : "higher") +
          " integrated terrain penalty"
        : "an increase of " +
          formatDistance(change) +
          " in integrated terrain penalty";
  return (
    "Compared with the shortest candidate, the terrain-focused route " +
    distance +
    " and has " +
    penalty +
    "."
  );
}
function PointEditor({
  label,
  point,
  mapReady,
  onSave,
  onPick,
}: {
  label: string;
  point: LonLat | null;
  mapReady: boolean;
  onSave: (p: LonLat) => void;
  onPick: () => void;
}) {
  const [error, setError] = useState("");
  return (
    <div className="point-editor">
      <div className="point-label">
        <span className={"point-badge " + (label === "B" ? "point-b" : "")}>
          {label}
        </span>
        <strong>
          {point
            ? coordinateLabel(point)
            : label === "A"
              ? "Choose a start"
              : "Choose a destination"}
        </strong>
      </div>
      <div className="point-actions">
        <button
          className="secondary-button"
          disabled={!mapReady}
          onClick={onPick}
        >
          <Crosshair size={16} />
          Set {label} on map
        </button>
        <details>
          <summary>Coordinates</summary>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              try {
                onSave(
                  parseCoordinate(
                    String(data.get("lat")),
                    String(data.get("lon")),
                  ),
                );
                setError("");
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            <div className="coordinate-fields">
              <label>
                Latitude °N
                <input
                  key={"lat" + point?.[1]}
                  name="lat"
                  aria-label={label + " latitude"}
                  aria-invalid={!!error}
                  aria-describedby={
                    error ? label + "-coordinate-error" : undefined
                  }
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  defaultValue={point?.[1] ?? ""}
                  required
                />
              </label>
              <label>
                Longitude °E
                <input
                  key={"lon" + point?.[0]}
                  name="lon"
                  aria-label={label + " longitude"}
                  aria-invalid={!!error}
                  aria-describedby={
                    error ? label + "-coordinate-error" : undefined
                  }
                  type="number"
                  step="any"
                  min="-180"
                  max="360"
                  defaultValue={point?.[0] ?? ""}
                  required
                />
              </label>
            </div>
            <button className="secondary-button" type="submit">
              Apply {label}
            </button>
            {error && (
              <p
                id={label + "-coordinate-error"}
                role="alert"
                className="field-error"
              >
                {error}
              </p>
            )}
          </form>
        </details>
      </div>
    </div>
  );
}
const ProfileChart = memo(function ProfileChart({
  route,
  color,
  onPoint,
}: {
  route: PlannedRoute;
  color: string;
  onPoint: (p: LonLat | null) => void;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const profile = route.terrain!.profile,
    coords = route.terrain!.coordinates;
  const min =
      Math.floor(
        profile.reduce((m, p) => Math.min(m, p.elevation), Infinity) / 10,
      ) *
        10 -
      5,
    max =
      Math.ceil(
        profile.reduce((m, p) => Math.max(m, p.elevation), -Infinity) / 10,
      ) *
        10 +
      5;
  const length = profile.at(-1)!.distance || 1;
  // Preserve min and max in each bin, including endpoints. Metrics use all samples.
  const plot = useMemo(() => {
    const ids = new Set([0, profile.length - 1]),
      bin = Math.max(1, Math.ceil(profile.length / 100));
    for (let i = 0; i < profile.length; i += bin) {
      let lo = i,
        hi = i;
      for (let j = i; j < Math.min(profile.length, i + bin); j++) {
        if (profile[j].elevation < profile[lo].elevation) lo = j;
        if (profile[j].elevation > profile[hi].elevation) hi = j;
      }
      ids.add(lo);
      ids.add(hi);
    }
    return [...ids]
      .sort((a, b) => a - b)
      .map((i) =>
        [
          50 + (profile[i].distance / length) * 530,
          145 - ((profile[i].elevation - min) / (max - min)) * 125,
        ].join(","),
      )
      .join(" ");
  }, [profile, length, min, max]);
  const point = index === null ? null : profile[index];
  const select = (i: number | null) => {
    setIndex(i);
    onPoint(i === null ? null : coords[i]);
  };
  return (
    <div className="profile-chart">
      <div className="section-title">
        <strong>Elevation profile</strong>
        <span>m above datum</span>
      </div>
      <svg
        viewBox="0 0 600 180"
        role="img"
        aria-label="Route elevation profile"
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect(),
            distance =
              Math.max(
                0,
                Math.min(
                  1,
                  (((e.clientX - box.left) / box.width) * 600 - 50) / 530,
                ),
              ) * length;
          let lo = 0,
            hi = profile.length - 1;
          while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (profile[mid].distance < distance) lo = mid + 1;
            else hi = mid;
          }
          select(lo);
        }}
        onPointerLeave={() => select(null)}
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1="50"
              x2="580"
              y1={20 + 125 * t}
              y2={20 + 125 * t}
              stroke="#394440"
            />
            <text
              x="43"
              y={25 + 125 * t}
              textAnchor="end"
              fill="#b3bcb5"
              fontSize="22"
            >
              {Math.round(max - (max - min) * t)}
            </text>
          </g>
        ))}
        <polyline
          points={plot}
          fill="none"
          stroke={color}
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
        <text x="50" y="173" fill="#b3bcb5" fontSize="22">
          0
        </text>
        <text x="580" y="173" textAnchor="end" fill="#b3bcb5" fontSize="22">
          {formatDistance(length)}
        </text>
        {point && (
          <g>
            <line
              x1={50 + (point.distance / length) * 530}
              x2={50 + (point.distance / length) * 530}
              y1="20"
              y2="145"
              stroke="#fff1dc"
              strokeDasharray="4 4"
            />
            <circle
              cx={50 + (point.distance / length) * 530}
              cy={145 - ((point.elevation - min) / (max - min)) * 125}
              r="5"
              fill="#fff1dc"
            />
          </g>
        )}
      </svg>
      <label className="profile-scrubber">
        Inspect profile{" "}
        <span>
          {point
            ? formatDistance(point.distance) +
              " · " +
              point.elevation.toFixed(0) +
              " m"
            : "Hover or use the slider"}
        </span>
        <input
          aria-label="Inspect elevation along route"
          type="range"
          min="0"
          max={profile.length - 1}
          value={index ?? 0}
          onChange={(e) => select(Number(e.target.value))}
          onBlur={() => select(null)}
          aria-valuetext={
            point
              ? formatDistance(point.distance) +
                ", elevation " +
                point.elevation.toFixed(0) +
                " metres"
              : undefined
          }
        />
      </label>
    </div>
  );
});
export default memo(function RoutePlanner(p: Props) {
  const routes = p.result?.routes ?? noRoutes,
    recommended = p.recommended;
  const current = routes[p.active] ?? routes[0],
    terrain = current?.terrain;
  const terrainComparison = useMemo(
    () =>
      compareTerrainCandidates(
        routes.find((route) => route.strategies?.some((s) => s.id === "shortest")),
        routes.find((route) => route.strategies?.some((s) => s.id === "terrain")),
      ),
    [routes],
  );
  function exportRoute() {
    if (!current) return;
    const parts = splitDateLine(current.coordinates),
      blob = new Blob(
        [
          JSON.stringify(
            {
              type: "Feature",
              geometry: { type: "MultiLineString", coordinates: parts },
              properties: {
                body: "Mars",
                latitudeType: "planetocentric",
                longitude: "east-positive",
                sphereRadiusM: metadata.radius,
                tier: current.tier,
                source: p.result?.meta?.sourcePage,
                terrainSha256: p.result?.meta?.sha256,
                derivedElevationSha256: p.result?.meta?.derivedSha256,
                terrainDataset: p.result?.meta?.id,
                name: current.name,
                strategies: current.strategies,
                lambda: terrain?.lambda,
                modelCost: terrain?.cost,
                terrainPenalty: terrain?.riskIntegral,
                distanceM: current.distance,
                assessedDistanceM: current.assessedDistance,
                unassessedConnectors: current.connectors,
                ascentM: terrain?.ascent,
                descentM: terrain?.descent,
                maxSlopeDegrees: terrain?.maxSlope,
                meanSlopeDegrees: terrain?.meanSlope,
                settings: p.settings,
                reachedObjectives: current.reached,
                scienceStops: current.scienceStops,
                stops: current.stops,
                quality: current.quality,
                warning:
                  "Research and education; not operational astronaut navigation",
              },
            },
            null,
            2,
          ),
        ],
        { type: "application/geo+json" },
      );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "marspath-" + current.tier + "-route.geojson";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="directions-content">
      {p.collapsed && (
        <div className="plan-summary">
          <span><strong>A → B</strong><small>{p.draft.waypoints.length ? p.draft.waypoints.length + " waypoints" : "Direct plan"}</small></span>
          <button className="text-button" onClick={p.onEdit}>Edit route</button>
        </div>
      )}
      <div id="route-planning" hidden={p.collapsed}>
      <h2 id="planning-heading" tabIndex={-1}>Plan route</h2>
      <p className="panel-intro">
        Choose anywhere on Mars. We’ll show what the available terrain can
        support.
      </p>
      <PointEditor
        label="A"
        point={p.draft.start}
        mapReady={p.mapReady}
        onSave={(start) => p.onDraft({ ...p.draft, start })}
        onPick={() => p.onPlacement("start")}
      />
      <div className="between-points">
        <button
          className="text-button"
          onClick={() =>
            p.onDraft({
              ...p.draft,
              start: p.draft.end,
              end: p.draft.start,
              waypoints: [...p.draft.waypoints].reverse(),
            })
          }
        >
          <ArrowDownUp size={15} />
          Swap A and B
        </button>
      </div>
      <PointEditor
        label="B"
        point={p.draft.end}
        mapReady={p.mapReady}
        onSave={(end) => p.onDraft({ ...p.draft, end })}
        onPick={() => p.onPlacement("end")}
      />
      {p.draft.waypoints.map((point, i) => (
        <div className="waypoint-row" key={i}>
          <MapPin size={16} />
          <span>
            Stop {i + 1}
            <small>{coordinateLabel(point)}</small>
          </span>
          <button
            className="icon-button"
            aria-label={"Remove stop " + (i + 1)}
            onClick={() =>
              p.onDraft({
                ...p.draft,
                waypoints: p.draft.waypoints.filter((_, j) => j !== i),
              })
            }
          >
            <Trash2 size={17} />
          </button>
        </div>
      ))}
      <div className="button-row">
        <button
          className="text-button"
          disabled={!p.mapReady || p.draft.waypoints.length >= 3}
          onClick={() => p.onPlacement("waypoint")}
        >
          <Plus size={16} />
          Add waypoint
        </button>
        <button
          className="text-button"
          onClick={() => {
            p.onDraft({ start: null, end: null, waypoints: [] });
            p.onPlacement(null);
          }}
        >
          <Trash2 size={15} />
          Clear
        </button>
      </div>
      <button
        className="example-button secondary-button"
        disabled={!p.mapReady}
        onClick={p.onExample}
      >
        {p.draft.start || p.draft.end ? "Replace draft with Jezero example" : "Try Jezero terrain example"}
      </button>
      <ScienceObjectives
        draft={p.draft}
        settings={p.settings}
        onSettings={p.onSettings}
        onDraft={p.onDraft}
        onExploreGoal={p.onExploreGoal}
      />
      </div>
      <div className="route-status" role="status" aria-live="polite">
        {p.pending
          ? "Calculating route candidates…"
          : p.error
            ? "No terrain route calculated"
            : p.result
              ? "Routes ready · " + p.result.reason
              : "Choose A and B to begin."}
        {p.result && (
          <small>
            {p.result.tier === "regional"
              ? "Regional terrain"
              : p.result.tier === "coarse"
                ? "Coarse terrain"
                : "Geographic planning"}{" "}
            · Research and education
          </small>
        )}
      </div>
      {p.error && (
        <div className="route-error" role="alert">
          <p>{p.error}</p>
          <button
            className="secondary-button"
            onClick={() =>
              p.onSettings({ ...p.settings, geographicOnly: true })
            }
          >
            Show geographic connection instead
          </button>
        </div>
      )}
      {p.result?.warnings.map((w) => (
        <p className="data-note" key={w}>
          {w}
        </p>
      ))}
      {routes.length > 0 && (
        <>
          <div className="section-title route-result-title">
            <h2 id="compare-routes">Compare routes</h2>
            <div className="result-actions">
            <button className="icon-button" aria-label="Export route & provenance" title="Export route & provenance" onClick={exportRoute}>
              <Download size={18} />
            </button>
            <button className="text-button" onClick={p.onFit}>
              Fit on map
            </button>
            </div>
          </div>
          <div className="route-options">
            {routes.map((r, i) => (
              <button
                key={r.id}
                className={
                  "route-option" + (current?.id === r.id ? " selected" : "")
                }
                aria-pressed={current?.id === r.id}
                onClick={() => p.onActive(i)}
              >
                <span
                  className="route-swatch"
                  style={{
                    borderColor: routeAppearance(
                      i,
                      recommended,
                      r.tier === "geographic",
                    ).color,
                    borderTopStyle: routeAppearance(
                      i,
                      recommended,
                      r.tier === "geographic",
                    ).pattern,
                  }}
                />
                <span>
                  <strong>{r.name}</strong>
                  {r.strategies && r.strategies.length > 1 && (
                    <small>{r.strategies.slice(1).map((s) => s.name).join(" · ")} found the same path</small>
                  )}
                  {r.tier !== "geographic" && i === recommended && (
                    <small>Recommended by your preferences</small>
                  )}
                </span>
                <b>{formatDistance(r.distance)}</b>
              </button>
            ))}
          </div>
          {current?.tier === "geographic" ? (
            <div className="data-note">
              <strong>Distance only</strong>
              <p>
                A great-circle connection through your stops. Terrain, ascent,
                slope, hazards and feasibility have not been assessed. This is
                not an EVA traverse.
              </p>
              {p.settings.geographicOnly && (
                <button
                  className="secondary-button"
                  onClick={() =>
                    p.onSettings({ ...p.settings, geographicOnly: false })
                  }
                >
                  Try available terrain
                </button>
              )}
            </div>
          ) : (
            <>
              {terrain && (
                <>
                  <div className="route-metrics">
                    <div>
                      <span>Ascent</span>
                      <strong>
                        {Math.round(terrain.ascent).toLocaleString()}
                        <small> m</small>
                      </strong>
                    </div>
                    <div>
                      <span>Descent</span>
                      <strong>
                        {Math.round(terrain.descent).toLocaleString()}
                        <small> m</small>
                      </strong>
                    </div>
                    <div>
                      <span>Maximum slope</span>
                      <strong>
                        {terrain.maxSlope.toFixed(1)}
                        <small>°</small>
                      </strong>
                    </div>
                    <div>
                      <span>Mean slope</span>
                      <strong>
                        {terrain.meanSlope.toFixed(1)}
                        <small>°</small>
                      </strong>
                    </div>
                  </div>
                  <ProfileChart
                    key={
                      current.id +
                      "-" +
                      current.terrain?.cost +
                      "-" +
                      current.terrain?.distance
                    }
                    route={current}
                    color={routeAppearance(p.active, recommended).color}
                    onPoint={p.onProfile}
                  />
                </>
              )}
              {current.tier === "coarse" && (
                <div className="data-note">
                  <strong>Coarse exploration context</strong>
                  <p>
                    Approximately 15 km cells hide local slopes, rocks and
                    hazards. This global connection is not a practical EVA
                    traverse.
                  </p>
                </div>
              )}
              <details className="route-explanation" open>
                <summary>Why this route?</summary>
                {terrainComparison && <p>{terrainComparison}</p>}
                <p>
                  {routes[recommended]?.name} has the best weighted score among
                  the evaluated candidates. The score compares normalized
                  distance, terrain penalty and missed verified objectives. Your
                  preference weights are {p.settings.distanceWeight} distance /{" "}
                  {p.settings.terrainWeight} terrain /{" "}
                  {p.settings.scienceWeight} science; unavailable science is
                  removed and weights renormalized. Lower modelled risk is not a
                  safety guarantee.
                </p>
                {p.settings.objectives.length > 0 && (
                  <p className="science-outcome">
                    Selected objectives reached: {current.reached.length} /{" "}
                    {p.settings.objectives.length}.{" "}
                    {current.reached
                      .map(
                        (id) => localObjectives.find((o) => o.id === id)?.name,
                      )
                      .join(", ") ||
                      "No verified objective reached by this candidate."}{" "}
                    {current.scienceStops
                      ?.map(
                        (id) => scienceTargets.find((t) => t.id === id)?.name,
                      )
                      .join(", ")}{" "}
                    {current.note}
                  </p>
                )}
                <p>
                  {p.result?.evaluatedCandidates} feasible candidates evaluated;{" "}
                  {p.result?.scienceAttempts ?? 0} optional-stop insertions
                  attempted. The balanced candidate is selected from that tested
                  pool; no global science optimum is claimed.
                </p>
                <p>
                  Endpoints and stops snap by{" "}
                  {current.snapping.map((n) => formatDistance(n)).join(", ")}.
                  Dotted connectors are unassessed and excluded from ascent and
                  slope statistics.
                </p>
              </details>
              <details className="quality-details">
                <summary>Data quality & coverage</summary>
                <dl>
                  <dt>Assessed route length</dt>
                  <dd>
                    {(current.distance
                      ? (current.assessedDistance / current.distance) * 100
                      : 0
                    ).toFixed(1)}
                    %
                  </dd>
                  <dt>Derived terrain grid</dt>
                  <dd>
                    {p.result?.tier === "regional"
                      ? "20 m projected"
                      : "0.25° (~14.8 km N–S)"}
                  </dd>
                  <dt>Native source spacing</dt>
                  <dd>
                    {p.result?.tier === "regional"
                      ? "20 m projected"
                      : "463.0935 m projected"}
                  </dd>
                  <dt>Valid cells in dataset</dt>
                  <dd>
                    {current.quality
                      ? (
                          (100 * current.quality.gridValidCells) /
                          current.quality.gridTotalCells
                        ).toFixed(1) + "%"
                      : "Unknown"}
                  </dd>
                  <dt>Missing cells along assessed path</dt>
                  <dd>
                    {current.quality
                      ? (
                          100 *
                          (1 -
                            current.quality.validPathCells /
                              current.quality.pathCells)
                        ).toFixed(1) + "%"
                      : "Unknown"}
                  </dd>
                  <dt>Independent V2 calculation checks</dt>
                  <dd>{validation.checks.length} recorded in release report</dd>
                  <dt>Computation + data loading</dt>
                  <dd>
                    {p.result?.elapsedMs.toFixed(0)} ms · {p.result?.cacheHits}{" "}
                    cached legs
                  </dd>
                  <dt>Alignment accuracy</dt>
                  <dd>Not independently measured</dd>
                  <dt>Missing data</dt>
                  <dd>Blocked during terrain search</dd>
                </dl>
                <p className="small-note">
                  Coverage is not a probability of safety. Rocks, climate and
                  radiation are excluded.
                </p>
                <a
                  className="text-link"
                  href={p.result?.meta?.sourcePage}
                  target="_blank"
                  rel="noreferrer"
                >
                  Original terrain product ↗
                </a>
                <Link className="text-link" href="/methodology/#validation-v2">
                  Independent calculation report ↗
                </Link>
              </details>
            </>
          )}
        </>
      )}
      <details className="advanced-settings">
        <summary>Advanced settings</summary>
        <label className="slider-label">
          Maximum modelled slope <span>{p.settings.maxSlope}°</span>
          <input
            aria-label="Maximum modelled slope"
            type="range"
            min="5"
            max="30"
            step="1"
            value={p.settings.maxSlope}
            onChange={(e) =>
              p.onSettings({ ...p.settings, maxSlope: +e.target.value })
            }
          />
        </label>
        <label className="slider-label">
          Terrain penalty strength <span>λ = {p.settings.riskWeight}</span>
          <input
            aria-label="Terrain penalty strength"
            type="range"
            min="1"
            max="10"
            step="1"
            value={p.settings.riskWeight}
            onChange={(e) =>
              p.onSettings({ ...p.settings, riskWeight: +e.target.value })
            }
          />
        </label>
        {(["distanceWeight", "terrainWeight", "scienceWeight"] as const).map(
          (key, i) => (
            <label className="slider-label" key={key}>
              {
                [
                  "Distance preference",
                  "Terrain preference",
                  "Science preference",
                ][i]
              }
              <span>{p.settings[key]}</span>
              <input
                aria-label={
                  [
                    "Distance preference",
                    "Terrain preference",
                    "Science preference",
                  ][i]
                }
                type="range"
                min="0"
                max="100"
                step="5"
                value={p.settings[key]}
                onChange={(e) =>
                  p.onSettings({ ...p.settings, [key]: +e.target.value })
                }
              />
            </label>
          ),
        )}
        <label className="layer-toggle">
          <span>Geographic connection only</span>
          <input
            type="checkbox"
            checked={p.settings.geographicOnly}
            onChange={(e) =>
              p.onSettings({ ...p.settings, geographicOnly: e.target.checked })
            }
          />
        </label>
        <p className="small-note">
          Slope limits are application assumptions, not NASA standards.
          Recommendation weights are normalized; unavailable criteria are
          removed.
        </p>
      </details>
      <button
        className="secondary-button full-width"
        disabled={!p.draft.start || !p.draft.end || p.pending}
        onClick={p.onRecalculate}
      >
        <RefreshCw size={16} />
        Recalculate
      </button>
      <Link className="text-link" href="/methodology/">
        Methods, calculations & limitations ↗
      </Link>
    </div>
  );
});
