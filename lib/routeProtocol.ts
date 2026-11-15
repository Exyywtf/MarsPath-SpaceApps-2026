import type { PlannerRequest, PlannerResult, PlannerSettings } from "./planner";
import type { ClimatePreferences, RouteAnalysis } from "./routeAnalysis";
import type { Ranking } from "./routeRanking";
import type { RouteEvidence } from "./routeEvidence";
import type { MissionParameters, MissionReturn, ReturnMode } from "./missionPlan";
import type { MissionDaylight } from "./missionEnvironment";
import type { routeVisibility } from "./terrainVisibility";

export type ComparisonRequest = {
  key: string;
  settings: PlannerSettings;
  climate: ClimatePreferences;
};
export type WorkerRequest =
  | { kind: "cancel"; id: number }
  | { kind: "return"; id: number; key: string; mode: ReturnMode }
  | { kind: "mission-context"; id: number; key: string; routeId?: string; parameters?: MissionParameters; returnKey?: string }
  | ({ kind: "calculate"; comparison: ComparisonRequest } & PlannerRequest)
  | { kind: "compare"; id: number; comparison: ComparisonRequest };
export type ComparisonResult = PlannerResult & { ranking: Ranking };
export type MissionContext = {
  daylight?: MissionDaylight;
  visibility?: { outbound?: Awaited<ReturnType<typeof routeVisibility>>; return?: Awaited<ReturnType<typeof routeVisibility>>; reason?: string };
  returnAnalysis?: RouteAnalysis;
  error?: string;
  elapsedMs: number;
};
export type WorkerReply =
  | { id: number; key: string; kind: "return"; result: MissionReturn }
  | { id: number; key: string; kind: "mission-context"; result: MissionContext }
  | { id: number; key: string; kind: "routes"; result: ComparisonResult }
  | { id: number; key: string; kind: "analysis"; analysis: Record<string, RouteAnalysis>; scores: number[]; ranking: Ranking }
  | { id: number; key: string; kind: "evidence"; evidence: Record<string, RouteEvidence> }
  | { id: number; key: string; kind: "route-error" | "analysis-error" | "evidence-error"; error: string };
