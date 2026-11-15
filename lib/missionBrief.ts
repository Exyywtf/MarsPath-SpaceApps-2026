import type { MissionAssumptions, MissionReturn } from "./missionPlan";
import { missionObjectives, missionTiming } from "./missionPlan";
import type { MissionContext } from "./routeProtocol";
import type { PlannerDraft, PlannerSettings, PlannedRoute } from "./planner";
import { formatDistance, splitDateLine, unwrapRoute } from "./planner";
import type { TerrainMeta } from "./routing";
import type { RouteAnalysis } from "./routeAnalysis";
import type { RouteEvidence } from "./routeEvidence";
import type { Ranking } from "./routeRanking";
import { coordinateLabel, type LonLat } from "./mars";
import { scienceTargets } from "./science";
import { reduceProfilePoints } from "./profileDisplay";

export type MissionBrief = {
  requestId: number;
  geometryKey: string;
  generatedAt: string;
  mission: MissionAssumptions;
  draft: PlannerDraft;
  settings: PlannerSettings;
  terrain?: TerrainMeta;
  selected: PlannedRoute;
  candidates: PlannedRoute[];
  ranking?: Ranking;
  scores?: number[];
  inbound?: MissionReturn;
  analysis?: RouteAnalysis;
  evidence?: RouteEvidence;
  context?: MissionContext;
  analysisStatus: "ready" | "pending" | "unavailable";
  evidenceStatus: "ready" | "pending" | "unavailable";
  contextStatus: "ready" | "pending" | "unavailable";
};

const version = "marspath-mission-v1";
const back = (brief: MissionBrief) => brief.inbound?.status === "ready" ? brief.inbound.route : undefined;

function legMetrics(route: PlannedRoute) {
  const t = route.terrain;
  return {
    id: route.id, candidate: route.name, tier: route.tier, distanceM: route.distance,
    assessedDistanceM: route.assessedDistance, unassessedDistanceM: Math.max(0, route.distance - route.assessedDistance),
    connectorDistanceM: route.connectors.reduce((sum, _, i) =>
      sum + route.snapping[i] * (i === 0 || i === route.connectors.length - 1 ? 1 : 2), 0),
    ascentM: t?.ascent, descentM: t?.descent, maxSlopeDegrees: t?.maxSlope, terrainPenaltyM: t?.riskIntegral,
    elevationProfile: t?.profile, stops: route.stops, reachedTargets: route.reachedTargets, quality: route.quality,
  };
}

export function missionGeoJson(brief: MissionBrief) {
  const inbound = back(brief);
  const { selected, mission, candidates, context } = brief;
  const features = [selected, ...(inbound ? [inbound] : [])].flatMap((route, index) => {
    const leg = index ? "return" : "outbound";
    return [{
      type: "Feature", geometry: { type: "MultiLineString", coordinates: splitDateLine(route.coordinates) },
      properties: { leg, ...legMetrics(route) },
    }, ...route.connectors.flatMap((points, i) => route.snapping[i] > 0 ? [{
      type: "Feature", geometry: { type: "MultiLineString", coordinates: splitDateLine(points) },
      properties: { leg, role: "unassessed-connector", offsetM: route.snapping[i], traversals: i === 0 || i === route.connectors.length - 1 ? 1 : 2 },
    }] : [])];
  });
  return {
    type: "FeatureCollection", features,
    mission: {
      version, coordinateSystem: "Mars planetocentric latitude, east-positive longitude, degrees",
      generatedAt: brief.generatedAt, requestId: brief.requestId, geometryKey: brief.geometryKey, assumptions: mission, draft: brief.draft,
      settings: brief.settings, outboundTerrain: brief.terrain, returnTerrain: brief.inbound?.status === "ready" ? brief.inbound.terrain : undefined,
      returnStatus: brief.inbound?.status ?? (mission.returnMode ? "pending" : "not-requested"),
      returnReason: brief.inbound?.reason,
      timing: !mission.returnMode || inbound ? missionTiming(selected, inbound, mission) : undefined,
      ranking: brief.ranking, candidates: candidates.map((route, i) => ({ ...legMetrics(route), score: brief.scores?.[i] })),
      analysisStatus: brief.analysisStatus, evidenceStatus: brief.evidenceStatus, contextStatus: brief.contextStatus,
      outboundAnalysis: brief.analysis, outboundEvidence: brief.evidence, missionConditions: context,
      limitations: ["Research and educational model", "Alignment accuracy is unknown", "Grid coverage leaves rock-scale hazards unresolved"],
    },
  };
}

const escapeHtml = (value: string | number | undefined) =>
  String(value ?? "Unavailable").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const number = (value: number | undefined | null, decimals = 1) => value == null ? "Unavailable" : value.toFixed(decimals);
const hours = (value: number | undefined) => value === undefined ? "Unavailable" : number(value / 3600, 2) + " Earth h";
const row = (values: (string | number | undefined)[]) => "<tr>" + values.map((value) => "<td>" + escapeHtml(value) + "</td>").join("") + "</tr>";

function displayPoints<T>(points: T[]) {
  const stride = Math.max(1, Math.ceil(points.length / 700));
  return points.filter((_, i) => i % stride === 0 || i === points.length - 1);
}

function routeDiagram(outbound: PlannedRoute, inbound?: PlannedRoute) {
  const fullOut = unwrapRoute(outbound.coordinates);
  const out = displayPoints(fullOut);
  const end = out.at(-1);
  let returning = inbound ? unwrapRoute(displayPoints(inbound.coordinates)) : [];
  if (end && returning.length) {
    const offset = Math.round((end[0] - returning[0][0]) / 360) * 360;
    returning = returning.map(([lon, lat]) => [lon + offset, lat]);
  }
  const stopPoints = (outbound.stopIndices ?? []).slice(1, -1).map((index) => fullOut[index]).filter(Boolean);
  const all = [...out, ...returning, ...stopPoints];
  if (all.length < 2) return "";
  const xs = all.map(([lon]) => lon), ys = all.map(([, lat]) => lat);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const lonScale = Math.max(0.01, Math.cos((y0 + y1) / 2 * Math.PI / 180));
  const scale = Math.min(540 / (Math.max(0.00001, x1 - x0) * lonScale), 150 / Math.max(0.00001, y1 - y0));
  const project = ([lon, lat]: LonLat) => [300 + (lon - (x0+x1)/2) * lonScale*scale, 100 - (lat - (y0+y1)/2)*scale];
  const points = (path: LonLat[]) => path.map((p) => project(p).map((x) => x.toFixed(2)).join(",")).join(" ");
  const [ax, ay] = project(out[0]), [bx, by] = project(out.at(-1)!);
  const stops = stopPoints.map((point, i) => {
    const [x, y] = project(point);
    return `<circle cx="${x}" cy="${y}" r="4" fill="#172522"/><text x="${x + 7}" y="${y - 7}" font-size="12">Stop ${i + 1}</text>`;
  }).join("");
  return `<svg viewBox="0 0 600 200" role="img" aria-label="Route geometry diagram. Solid outbound, dashed return.">
    <rect x="1" y="1" width="598" height="198" fill="#f6f7f1" stroke="#a7b5ae"/>
    <polyline fill="none" points="${points(out)}" stroke="#9b4314" stroke-width="3"/>
    ${returning.length ? `<polyline fill="none" points="${points(returning)}" stroke="#187362" stroke-dasharray="5 4" stroke-width="2"/>` : ""}
    ${stops}
    <text x="${ax-12}" y="${ay-9}" font-size="14">A</text><text x="${bx+8}" y="${by-8}" font-size="14">B</text>
    <text x="563" y="189" font-size="11">N ↑</text></svg>
    <p class="caption">Centred Mars longitude/latitude diagram. Solid outbound · dashed return.</p>`;
}

function profileDiagram(route: PlannedRoute, label: string) {
  const fullProfile = route.terrain?.profile ?? [];
  const profile = reduceProfilePoints(fullProfile.map((point) => ({ ...point, value: point.elevation })));
  if (profile.length < 2) return "";
  const [lo, hi] = fullProfile.reduce(([lo, hi], { elevation }) =>
    [Math.min(lo, elevation), Math.max(hi, elevation)], [Infinity, -Infinity]);
  const length = profile.at(-1)!.distance || 1;
  const points = profile.map(({ distance, elevation }) =>
    `${25 + distance / length * 550},${108 - (elevation - lo) / Math.max(1, hi - lo) * 81}`).join(" ");
  return `<figure><svg viewBox="0 0 600 130" role="img" aria-label="${label} elevation profile">
    <rect x="1" y="1" width="598" height="128" fill="#f6f7f1" stroke="#a7b5ae"/>
    <polyline fill="none" points="${points}" stroke="#9b4314" stroke-width="2.5"/>
    </svg><figcaption class="caption">${label} elevation · ${lo.toFixed(0)} to ${hi.toFixed(0)} m · ${formatDistance(length)} assessed</figcaption></figure>`;
}

function link(url: string | undefined, label: string) {
  return url && /^https:\/\//.test(url) ? `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>` : escapeHtml(label);
}

function environmentRows(analysis: RouteAnalysis | undefined, leg: string) {
  return Object.entries(analysis?.factors ?? {}).map(([id, value]) =>
    row([leg, id, value.mean == null ? "Unavailable" : `${number(value.mean)} ${id === "temperature" ? "K" : id === "pressure" ? "Pa" : id === "wind" ? "m/s" : "mSv/year"}`,
      value.coverage == null ? "Unavailable" : number(value.coverage * 100) + "%"])).join("");
}

export function renderMissionBrief(brief: MissionBrief) {
  const { mission, selected, context, candidates } = brief;
  const inbound = back(brief), timing = missionTiming(selected, inbound, mission);
  const stops = selected.stops?.slice(1, -1) ?? [];
  const name = mission.name || "MarsPath mission";
  const objective = (mission.objective === "custom" ? mission.customObjective : missionObjectives.find(([id]) => id === mission.objective)?.[1]) || "Unspecified";
  const terrain = brief.terrain;
  const referenceRecords = [...Object.values(brief.analysis?.factors ?? {}), ...Object.values(context?.returnAnalysis?.factors ?? {})];
  const refs = [...new Map(referenceRecords.map((factor) => [factor.source, factor])).values()];
  const scenarios = [...new Set(referenceRecords.map(({ scenario }) => scenario))];
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(name)} | MarsPath Mission Brief</title>
<style>
  :root{color:#172522;background:#eef1ec;font:15px/1.5 system-ui,sans-serif}body{max-width:780px;margin:auto;padding:24px;color:#172522}
  article{background:white;padding:clamp(16px,4vw,36px)}header{border-bottom:2px solid #9b4314;padding-bottom:14px}h1,h2,h3{line-height:1.18}
  h1{font-size:2.2rem;margin:.35em 0}h2{font-size:1.26rem;border-top:1px solid #a7b5ae;padding-top:10px}h3{font-size:1rem}
  p{margin:.6em 0}.caption,small{color:#45534f}svg{width:100%;display:block}table{width:100%;border-collapse:collapse;font-size:.84rem}
  th,td{border-bottom:1px solid #c9d2cc;padding:6px;text-align:left;overflow-wrap:anywhere}thead{background:#edf2ee}
  button{font:inherit;min-height:44px;background:#eee3da;border:1px solid #9b4314;border-radius:5px;padding:8px 14px;cursor:pointer;margin-bottom:12px}
  a{color:#815031}code{overflow-wrap:anywhere}section,figure{margin:15px 0}
  @media print{@page{size:A4;margin:12mm}body{max-width:none;margin:0;padding:0;background:white;font-size:11pt}article{padding:0}button{display:none}h2,h3{break-after:avoid}svg,figure,tr{break-inside:avoid}thead{display:table-header-group}}
</style>
<body><button type="button" id="print">Print / Save as PDF</button><article>
<header><strong>MarsPath · Mission Brief</strong><h1>${escapeHtml(name)}</h1>
<p>${escapeHtml(objective)}</p><small>${escapeHtml(brief.generatedAt)} · Research and educational model</small></header>
<section><h2>Journey</h2>
<p>A · ${escapeHtml(brief.draft.start ? coordinateLabel(brief.draft.start) : undefined)}<br>B · ${escapeHtml(brief.draft.end ? coordinateLabel(brief.draft.end) : undefined)}</p>
<p>${escapeHtml(number(mission.speedKmh, 2))} km/h assumed · ${escapeHtml(mission.dwellMinutes ?? 0)} min per outbound stop · ${escapeHtml(mission.departure ? mission.departure + " UTC" : "Departure unset")}</p>
<p>${mission.returnMode && !inbound ? "Return " + escapeHtml(brief.inbound?.status ?? "pending") + ". " + escapeHtml(brief.inbound?.reason ?? "")
    : "Total " + formatDistance(timing.distanceM) + " · " + hours(timing.elapsedSeconds)}</p>
<table><thead><tr><th>Leg</th><th>Tier</th><th>Distance</th><th>Ascent / descent</th><th>Max slope</th><th>Connectors</th></tr></thead><tbody>
${[selected, ...(inbound ? [inbound] : [])].map((route, i) => row([i ? "Return" : "Outbound", route.tier, formatDistance(route.distance),
    route.terrain ? `${formatDistance(route.terrain.ascent)} / ${formatDistance(route.terrain.descent)}` : "Unassessed",
    route.terrain ? number(route.terrain.maxSlope) + "°" : "Unassessed", formatDistance(legMetrics(route).connectorDistanceM)])).join("")}</tbody></table>
${routeDiagram(selected, inbound)}${profileDiagram(selected, "Outbound")}${inbound ? profileDiagram(inbound, "Return") : ""}
</section><section><h2>Route comparison and evidence</h2>
<p>Selected ${escapeHtml(selected.name)}. ${formatDistance(selected.assessedDistance)} assessed outbound.
  ${formatDistance(Math.max(0, selected.distance-selected.assessedDistance))} unassessed outbound.</p>
<table><thead><tr><th>Candidate</th><th>Distance</th><th>Score</th></tr></thead><tbody>
${candidates.map((route, i) => row([route.name, formatDistance(route.distance), number(brief.scores?.[i], 3)])).join("")}</tbody></table>
<p>Weights · ${escapeHtml(Object.entries(brief.ranking?.weights ?? {}).map(([label, weight]) => label + " " + (weight * 100).toFixed(0) + "%").join(" · ") || "Pending")}</p>
<p>Published outcrops reached · ${escapeHtml(selected.reachedTargets?.map((id) => scienceTargets.find((target) => target.id === id)?.name ?? id).join(", ") || "None")}</p>
${stops.length ? `<h3>Outbound stops</h3><ol>${stops.map((point) => `<li>${escapeHtml(coordinateLabel(point, 5))} · ${escapeHtml(mission.dwellMinutes ?? 0)} min dwell</li>`).join("")}</ol>` : ""}
<p>Mapped geology and surface evidence · ${escapeHtml(brief.evidenceStatus)}${brief.evidence ? " · " + escapeHtml(brief.evidence.provenance.datasetVersion) : ""}.</p>
</section><section><h2>Mission conditions</h2>
<p>Outbound environmental analysis · ${escapeHtml(brief.analysisStatus)}. Mission conditions · ${escapeHtml(brief.contextStatus)}.</p>
${brief.analysis || context?.returnAnalysis ? `<table><thead><tr><th>Leg</th><th>Field</th><th>Mean</th><th>Valid length</th></tr></thead>
<tbody>${environmentRows(brief.analysis, "Outbound")}${environmentRows(context?.returnAnalysis, "Return")}</tbody></table>` : ""}
${scenarios.length ? `<ul class="caption">${scenarios.map((scenario) => `<li>${escapeHtml(scenario)}</li>`).join("")}</ul>` : ""}
<p>Daylight · ${context?.daylight?.timeline ? hours(context.daylight.timeline.daylightSeconds) + " of " + hours(context.daylight.timeline.durationSeconds)
    : escapeHtml(context?.daylight?.reason ?? "Unavailable")}.</p>
<p>Station · ${escapeHtml(mission.station ? coordinateLabel(mission.station) : undefined)}.
  Station height ${number(mission.stationHeightM)} m · observer height ${number(mission.observerHeightM)} m.</p>
${([["Outbound", context?.visibility?.outbound], ["Return", context?.visibility?.return]] as const).map(([label, v]) => v
    ? `<p>${label} line of sight · ${v.samples.filter(({status}) => status === "clear").length} clear,
      ${v.samples.filter(({status}) => status === "obstructed").length} obstructed and
      ${v.samples.filter(({status}) => status === "unknown").length} unknown · ${number(v.spacingM)} m sample spacing.</p>`
    : label === "Outbound" ? `<p>Line of sight · ${escapeHtml(context?.visibility?.reason ?? "Unavailable")}.</p>` : "").join("")}
<p>Geometric daylight leaves shadows, dust and extinction unassessed. Terrain visibility leaves signal propagation and equipment reliability unassessed.</p>
</section><section><h2>Sources and reproducibility</h2><p>Mission format ${version} · request ${brief.requestId}. Mars east-positive planetocentric coordinates.
Alignment accuracy and rock-scale terrain remain unresolved. Distance and duration are model estimates.</p>
<ul>${terrain ? `<li>${link(terrain.sourcePage, terrain.credit ?? terrain.name)} · ${terrain.angularStep ? `${terrain.angularStep}°` : `${number(terrain.pixelSize, 2)} m`} grid${terrain.terms ? " · " + escapeHtml(terrain.terms) : ""} · <code>${escapeHtml(terrain.derivedSha256 ?? terrain.sha256)}</code></li>` : ""}
${refs.map((factor) => `<li>${link(factor.source, factor.credit)} · ${link(factor.terms, /^https:\/\//.test(factor.terms) ? "Usage terms" : factor.terms)} · <code>${escapeHtml(factor.checksum)}</code></li>`).join("")}
${context?.daylight ? `<li>${link(context.daylight.provenance.source, context.daylight.provenance.model)} · ${link(context.daylight.provenance.clockSource, "UTC leap-second source")}</li>` : ""}
<li>${link("https://pmc.ncbi.nlm.nih.gov/articles/PMC7116714/#Tab2", "Stack et al. (2020), Jezero outcrop type locations")}</li></ul>
</section></article><script>document.getElementById("print").addEventListener("click",()=>window.print());</script></body></html>`;
}

function temporaryUrl(contents: string, mime: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return url;
}

export function openMissionBrief(brief: MissionBrief) {
  window.open(temporaryUrl(renderMissionBrief(brief), "text/html;charset=utf-8"), "_blank", "noopener,noreferrer");
}

export function downloadMission(brief: MissionBrief) {
  const element = document.createElement("a");
  element.href = temporaryUrl(JSON.stringify(missionGeoJson(brief)), "application/geo+json");
  element.download = "marspath-mission.geojson";
  element.click();
}
