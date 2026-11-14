import {
  explorationScience, mineralStyles, scienceCellValue, scienceSources, thermalUnit,
  type GeologyGrid, type MineralObservation, type ScienceGrid,
} from "./explorationScience";
import { marsDistance, MARS_RADIUS } from "./mars";
import type { PlannedRoute } from "./planner";
import { orderedSpans, sphericalArc, sphericalIntervals, sphericalVector, type SpanRole, type SphericalVector } from "./routeAnalysis";

type UnitTransition = { from: string; to: string; distanceM: number };
export type ObservationDistance = { observation: MineralObservation; distanceM: number };
type EvidenceSection = {
  lengthM: number;
  geology?: { validLengthM: number; unitLengthM: Record<string, number>; changes: UnitTransition[] };
  thermal?: { validLengthM: number; min: number | null; mean: number | null; max: number | null };
  minerals?: Partial<Record<MineralObservation["kind"], ObservationDistance>>;
};

export const evidenceProvenance = {
  version: "marspath-route-evidence-v1",
  datasetVersion: explorationScience.version,
  geology: {
    ...scienceSources.geology, checksum: explorationScience.geology.data.sha256,
    resolution: "0.125° atlas cells from USGS 1:20,000,000 SIM 3292",
  },
  thermal: {
    ...scienceSources.thermal, checksum: explorationScience.thermal.data.sha256,
    unit: thermalUnit, resolution: "0.25° fully supported cell means from 0.05° source pixels",
  },
  minerals: {
    ...scienceSources.minerals, checksum: explorationScience.minerals.data.sha256,
    resolution: "Published record centres; detection footprints and absolute position accuracy unavailable",
  },
  method: "Spherical Mars great-circle arcs split at 0.125° degree cell edges. Length-weighted grid evidence is reported per role. Centre distances are minima to the full arcs.",
  rankingWeight: 0,
  ice: { ...scienceSources.ice, status: "Published numerical depth grids unavailable", rankingWeight: 0 },
} as const;

export type RouteEvidence = {
  provenance: typeof evidenceProvenance;
  roles: Partial<Record<SpanRole, EvidenceSection>>;
  elapsedMs: number;
};
export type EvidenceInputs = {
  geology: GeologyGrid | null; thermal: ScienceGrid | null; minerals: MineralObservation[] | null;
};

const dot = (a: SphericalVector, b: SphericalVector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function arcDistance(point: SphericalVector, arc: NonNullable<ReturnType<typeof sphericalArc>>) {
  const t = Math.atan2(dot(point, arc.v), dot(point, arc.u));
  const nearest = t >= 0 && t <= arc.theta ? arc.at(t) : dot(point, arc.u) >= dot(point, arc.end) ? arc.u : arc.end;
  const chord = Math.hypot(point[0] - nearest[0], point[1] - nearest[1], point[2] - nearest[2]);
  return 2 * MARS_RADIUS * Math.asin(Math.min(1, chord / 2));
}

export async function analyseEvidence(route: PlannedRoute, inputs: EvidenceInputs, cancelled: () => boolean): Promise<RouteEvidence> {
  const start = performance.now();
  const roles: RouteEvidence["roles"] = {};
  const weightedThermal: Partial<Record<SpanRole, number>> = {};
  const prepared = inputs.minerals?.map((observation) => ({ observation, vector: sphericalVector(observation.point) }));
  let lastUnit: string | undefined, lastRole: SpanRole | undefined, count = 0;
  for (const { a, b, role } of orderedSpans(route)) {
    const lengthM = marsDistance(a, b);
    if (lengthM <= 1e-6) continue;
    if (role !== lastRole) lastUnit = undefined;
    lastRole = role;
    const section = roles[role] ??= {
      lengthM: 0,
      geology: inputs.geology ? { validLengthM: 0, unitLengthM: {}, changes: [] } : undefined,
      thermal: inputs.thermal ? { validLengthM: 0, min: null, mean: null, max: null } : undefined,
      minerals: prepared ? {} : undefined,
    };
    const { geology, thermal, minerals } = section;
    let distanceM = section.lengthM;
    if (geology || thermal) for (const { point, length } of sphericalIntervals(a, b, .125)) {
      if (geology && inputs.geology) {
        const fid = scienceCellValue(inputs.geology, point);
        const code = fid === null ? undefined : inputs.geology.catalog[fid];
        if (code) {
          geology.unitLengthM[code] = (geology.unitLengthM[code] ?? 0) + length;
          geology.validLengthM += length;
          if (lastUnit && lastUnit !== code) geology.changes.push({ from: lastUnit, to: code, distanceM });
        }
        lastUnit = code;
      }
      if (thermal && inputs.thermal) {
        const value = scienceCellValue(inputs.thermal, point);
        if (value !== null) {
          thermal.validLengthM += length;
          thermal.min = Math.min(thermal.min ?? value, value);
          thermal.max = Math.max(thermal.max ?? value, value);
          weightedThermal[role] = (weightedThermal[role] ?? 0) + value * length;
        }
      }
      distanceM += length;
    }
    if (minerals && prepared) {
      const arc = sphericalArc(a, b);
      if (arc) for (const { observation, vector } of prepared) {
        const distanceM = arcDistance(vector, arc);
        if (distanceM < (minerals[observation.kind]?.distanceM ?? Infinity)) minerals[observation.kind] = { observation, distanceM };
      }
    }
    section.lengthM += lengthM;
    if (++count % 48 === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (cancelled()) throw new Error("Scientific route evidence was superseded.");
    }
  }
  for (const [role, section] of Object.entries(roles) as [SpanRole, EvidenceSection][]) {
    if (section.thermal?.validLengthM) section.thermal.mean = weightedThermal[role]! / section.thermal.validLengthM;
  }
  if (cancelled()) throw new Error("Scientific route evidence was superseded.");
  return { provenance: evidenceProvenance, roles, elapsedMs: performance.now() - start };
}

export const observationKinds = Object.keys(mineralStyles) as MineralObservation["kind"][];
