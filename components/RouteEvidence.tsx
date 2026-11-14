import type { PlannedRoute } from "@/lib/planner";
import { evidenceProvenance, observationKinds, type ObservationDistance, type RouteEvidence } from "@/lib/routeEvidence";
import { explorationScience, mineralStyles, thermalUnit } from "@/lib/explorationScience";
import { formatDistance } from "@/lib/planner";
import Accordion from "./Accordion";
import EvidenceLink from "./EvidenceLink";
import StyledSelect from "./StyledSelect";

const units = new Map(explorationScience.geology.units.map((unit) => [unit.code, unit]));
export const routeEvidenceSection = (route: PlannedRoute, evidence?: RouteEvidence) =>
  evidence?.roles[route.tier === "geographic" ? "geographic" : "terrain"];

type Props = {
  route: PlannedRoute;
  routes: PlannedRoute[];
  evidence?: Record<string, RouteEvidence>;
  current?: RouteEvidence;
  pending: boolean;
  error?: string;
  unit: string;
  onUnit: (unit: string) => void;
};

function percentage(length: number, total: number) {
  return total ? Math.min(100, 100 * length / total).toFixed(1) + "%" : "Unavailable";
}

function MineralDistance({ entry }: { entry?: ObservationDistance }) {
  if (!entry) return <>Unavailable</>;
  const { observation, distanceM } = entry;
  const source = mineralStyles[observation.kind];
  return <><span>{distanceM < 1000 ? "Within 1 km of" : formatDistance(distanceM) + " from"} </span>
    <EvidenceLink href={source.source} target="_blank" rel="noreferrer">
      {observation.kind === "crism" ? observation.id : observation.label}
    </EvidenceLink></>;
}

export default function RouteEvidencePanel({ route, routes, evidence, current, pending, error, unit, onUnit }: Props) {
  const section = routeEvidenceSection(route, current);
  const connector = current?.roles.connector;
  const main = route.tier === "geographic" ? "Geographic line" : "Assessed terrain path";
  const geological = section?.geology, thermal = section?.thermal;
  const unitLengths = Object.entries(geological?.unitLengthM ?? {}).sort((a, b) => b[1] - a[1]);
  return <Accordion className="quality-details route-evidence" title="Geology & surface evidence">
    <p className="small-note" role="status">{error ?? (pending
      ? current ? "Updating mapped evidence…" : "Calculating mapped evidence…"
      : "Exploration context · 0% ranking weight")}</p>
    {section && <>
      <p className="small-note">{main} · {formatDistance(section.lengthM)} · geographic alignment accuracy is unknown</p>
      <label className="route-evidence-filter">
        Mapped unit to compare
        <StyledSelect value={unit} onChange={(event) => onUnit(event.target.value)}>
          <option value="">All units encountered</option>
          {explorationScience.geology.units.map((item) =>
            <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}
        </StyledSelect>
      </label>
      {unit ? (
        <dl className="route-evidence-metrics">
          {routes.map((item) => {
            const area = routeEvidenceSection(item, evidence?.[item.id]);
            return <div key={item.id}>
              <dt>{item.name}</dt>
              <dd>{area?.geology && area.geology.validLengthM > 0
                ? formatDistance(area.geology.unitLengthM[unit] ?? 0) + " mapped"
                : "Unavailable"}</dd>
            </div>;
          })}
        </dl>
      ) : !!unitLengths.length && <dl className="route-evidence-metrics">
        {unitLengths.map(([code, length]) => <div key={code}>
          <dt>{code} · {units.get(code)?.name}</dt><dd>{formatDistance(length)}</dd>
        </div>)}
      </dl>}
      <p className="small-note">{geological
        ? `${percentage(geological.validLengthM, section.lengthM)} mapped at 0.125° · ${geological.changes.length} mapped-unit changes`
        : "Geologic unit coverage unavailable"}</p>
      <dl className="route-evidence-metrics">
        <div>
          <dt>TES apparent thermal inertia</dt>
          <dd>{thermal?.mean != null ? `${Math.round(thermal.mean)} ${thermalUnit}` : "Unavailable"}</dd>
        </div>
        {thermal && <div>
          <dt>Thermal coverage · 0.25°</dt>
          <dd>{percentage(thermal.validLengthM, section.lengthM)}</dd>
        </div>}
        {thermal?.min != null && <div><dt>Supported range</dt><dd>{thermal.min}–{thermal.max} {thermalUnit}</dd></div>}
        {observationKinds.map((kind) => <div key={kind}>
          <dt>Closest {mineralStyles[kind].label}</dt>
          <dd><MineralDistance entry={section.minerals?.[kind]} /></dd>
        </div>)}
      </dl>
      {connector && <p className="small-note">
        Endpoint and stop connectors are recorded separately in the export
        {connector.thermal ? ` · ${percentage(connector.thermal.validLengthM, connector.lengthM)} thermal coverage` : ""}.
      </p>}
      <p className="small-note">Mapped units indicate regional geology. Mineral distances use catalogue centres. Thermal inertia describes apparent thermal response.</p>
    </>}
    <EvidenceLink className="text-link" href="/methodology/#exploration-science">Grid, coverage and route evidence method</EvidenceLink>
    <EvidenceLink className="text-link" href={evidenceProvenance.ice.paper} target="_blank" rel="noreferrer">SWIM study · depth grids unavailable</EvidenceLink>
  </Accordion>;
}

export function mappedUnitExplanation(routes: PlannedRoute[], chosen: PlannedRoute, evidence: Props["evidence"], unit: string) {
  const geology = routeEvidenceSection(chosen, evidence?.[chosen.id])?.geology;
  if (!geology?.validLengthM) return null;
  if (unit) {
    const length = geology.unitLengthM[unit] ?? 0;
    const result = length ? `${formatDistance(length)} in ${unit}` : `0 m in ${unit} across its mapped coverage`;
    return `${chosen.name} has ${result}. The chosen mapped unit is a research comparison with zero score weight.`;
  }
  const distinct = Object.keys(geology.unitLengthM).sort().join(",");
  const other = routes.find((item) => {
    if (item.id === chosen.id) return false;
    const comparison = routeEvidenceSection(item, evidence?.[item.id])?.geology;
    return comparison?.validLengthM && Object.keys(comparison.unitLengthM).sort().join(",") !== distinct;
  });
  return other ? `${chosen.name} and ${other.name} cross different mapped units at 0.125°. Geology, mineral centres and thermal inertia have zero score weight.`
    : "Geology, mineral centres and thermal inertia add context with zero score weight.";
}
