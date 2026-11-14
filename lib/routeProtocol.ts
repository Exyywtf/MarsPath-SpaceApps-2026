import type { PlannerRequest, PlannerResult, PlannerSettings } from "./planner";
import type { ClimatePreferences, RouteAnalysis } from "./routeAnalysis";
import type { Ranking } from "./routeRanking";
import type { RouteEvidence } from "./routeEvidence";

export type ComparisonRequest = {
  key: string;
  settings: PlannerSettings;
  climate: ClimatePreferences;
};
export type WorkerRequest =
  | { kind: "cancel"; id: number }
  | ({ kind: "calculate"; comparison: ComparisonRequest } & PlannerRequest)
  | { kind: "compare"; id: number; comparison: ComparisonRequest };
export type ComparisonResult = PlannerResult & { ranking: Ranking };
export type WorkerReply =
  | { id: number; key: string; kind: "routes"; result: ComparisonResult }
  | { id: number; key: string; kind: "analysis"; analysis: Record<string, RouteAnalysis>; scores: number[]; ranking: Ranking }
  | { id: number; key: string; kind: "evidence"; evidence: Record<string, RouteEvidence> }
  | { id: number; key: string; kind: "route-error" | "analysis-error" | "evidence-error"; error: string };
