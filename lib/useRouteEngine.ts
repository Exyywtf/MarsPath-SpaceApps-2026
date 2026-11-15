"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PlannerDraft, PlannerSettings } from "./planner";
import type { ClimatePreferences, RouteAnalysis } from "./routeAnalysis";
import type { ComparisonRequest, ComparisonResult, MissionContext, WorkerReply, WorkerRequest } from "./routeProtocol";
import { matchingRouteAnalyses, matchingRouteEvidence } from "./routeSnapshot";
import type { RouteEvidence } from "./routeEvidence";
import type { MissionReturn, ReturnMode } from "./missionPlan";

type State = {
  geometryKey: string;
  requestKey: string;
  generation?: number;
  result?: ComparisonResult;
  error?: string;
  analysis?: Record<string, RouteAnalysis>;
  previousAnalysis?: Record<string, RouteAnalysis>;
  analysisError?: string;
  evidence?: Record<string, RouteEvidence>;
  previousEvidence?: Record<string, RouteEvidence>;
  evidenceError?: string;
  comparisonKey?: string;
};

export function useRouteEngine(
  draft: PlannerDraft,
  settings: PlannerSettings,
  revision: number,
  climate: ClimatePreferences,
  removalRevision: number,
  returnMode: ReturnMode = null,
) {
  const worker = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const { maxSlope, riskWeight, objectives, geographicOnly } = settings;
  const hasEndpoints = !!draft.start && !!draft.end;
  const geometryKey = JSON.stringify([draft, maxSlope, riskWeight, objectives, geographicOnly, removalRevision]);
  const requestKey = revision + ":" + geometryKey;
  const comparison = useMemo<ComparisonRequest>(() => ({
    key: JSON.stringify([settings.distanceWeight, settings.terrainWeight, settings.scienceWeight, climate]),
    settings,
    climate,
  }), [settings, climate]);
  const input = useRef({ geometryKey, requestKey, comparison });
  const requestedKey = useRef("");
  const [state, setState] = useState<State>({ geometryKey: "", requestKey: "" });
  const [inbound, setInbound] = useState<{ key: string; result: MissionReturn }>();
  const [missionContext, setMissionContext] = useState<{ key: string; result: MissionContext }>();
  const contextRequested = useRef("");
  const requestContext = useCallback((message: Extract<WorkerRequest, { kind: "mission-context" }>) => {
    contextRequested.current = message.key;
    worker.current?.postMessage(message);
  }, []);
  const returnKey = JSON.stringify([requestKey, returnMode]);
  const returnRequested = useRef("");
  useLayoutEffect(() => { input.current = { geometryKey, requestKey, comparison }; }, [geometryKey, requestKey, comparison]);

  useEffect(() => {
    const w = new Worker("/route-worker.js");
    worker.current = w;
    w.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
      const { geometryKey, requestKey, comparison } = input.current;
      if (data.id !== requestId.current || requestKey !== requestedKey.current) return;
      if (data.kind === "mission-context") {
        if (data.key === contextRequested.current) setMissionContext({ key: data.key, result: data.result });
        return;
      }
      if (data.kind === "return") {
        if (data.key === returnRequested.current) setInbound({ key: data.key, result: data.result });
        return;
      }
      if (data.kind !== "route-error" && data.key !== comparison.key) return;
      if (data.kind === "routes") {
        setState((old) => {
          const sameOrder = old.result?.routes.length === data.result.routes.length &&
            old.result.routes.every((route, i) => route.id === data.result.routes[i].id);
          const sameRoutes = old.generation === data.id && sameOrder;
          const retained = old.geometryKey === geometryKey
            ? matchingRouteAnalyses(old.result, data.result, old.analysis ?? old.previousAnalysis)
            : undefined;
          const retainedEvidence = old.geometryKey === geometryKey
            ? matchingRouteEvidence(old.result, data.result, old.evidence ?? old.previousEvidence)
            : undefined;
          // The routes reply carries provisional scores. Keep the previous
          // comparison visible until the matching analysis reply refreshes it.
          const retainRanking = old.comparisonKey === data.key && sameOrder &&
            data.result.routes.every((route) => retained?.[route.id]);
          const result = {
            ...data.result,
            routes: sameRoutes ? old.result!.routes : data.result.routes,
            ...(retainRanking && { scores: old.result!.scores, ranking: old.result!.ranking }),
          };
          return {
            geometryKey, requestKey, generation: data.id,
            comparisonKey: data.key,
            result,
            analysis: sameRoutes ? old.analysis : undefined,
            previousAnalysis: retained,
            evidence: sameRoutes ? old.evidence : undefined,
            previousEvidence: retainedEvidence,
          };
        });
      } else if (data.kind === "analysis") {
        setState((old) => old.generation === data.id && old.result ? {
          ...old, result: { ...old.result, scores: data.scores, ranking: data.ranking },
          analysis: data.analysis, previousAnalysis: undefined, analysisError: undefined,
        } : old);
      } else if (data.kind === "analysis-error") {
        setState((old) => old.generation === data.id ? { ...old, analysisError: data.error } : old);
      } else if (data.kind === "evidence") {
        setState((old) => old.generation === data.id && old.result ? {
          ...old, evidence: data.evidence, previousEvidence: undefined, evidenceError: undefined,
        } : old);
      } else if (data.kind === "evidence-error") {
        setState((old) => old.generation === data.id ? { ...old, evidenceError: data.error } : old);
      } else {
        setState({ geometryKey, requestKey, error: data.error });
      }
    };
    w.onerror = () => setState((old) => {
      const { geometryKey, requestKey } = input.current;
      return old.requestKey === requestKey && old.result
        ? { ...old, analysisError: "The route worker stopped.", evidenceError: "The route worker stopped." }
        : { geometryKey, requestKey, error: "The route worker failed. Reload the page to restart it." };
    });
    return () => { w.terminate(); worker.current = null; };
  }, []);

  useEffect(() => {
    const id = ++requestId.current;
    requestedKey.current = requestKey;
    worker.current?.postMessage({ id, kind: "cancel" } satisfies WorkerRequest);
    if (!draft.start || !draft.end) return;
    const timer = setTimeout(() => {
      const comparison = input.current.comparison;
      worker.current?.postMessage({ id, kind: "calculate", draft, settings: comparison.settings, comparison } satisfies WorkerRequest);
    }, 150);
    return () => clearTimeout(timer);
  }, [draft, requestKey]);

  const compareKey = comparison.key;
  useEffect(() => {
    if (!hasEndpoints) return;
    const id = requestId.current;
    const timer = setTimeout(() => {
      worker.current?.postMessage({ id, kind: "compare", comparison: input.current.comparison } satisfies WorkerRequest);
    }, 90);
    return () => clearTimeout(timer);
  }, [compareKey, hasEndpoints]);

  const complete = hasEndpoints && state.requestKey === requestKey;
  const generation = complete && state.result ? state.generation : undefined;
  useEffect(() => {
    const previous = returnRequested.current;
    returnRequested.current = returnMode ? returnKey : "";
    if (generation !== undefined && (returnMode || previous)) {
      worker.current?.postMessage({ kind: "return", id: generation, key: returnKey, mode: returnMode } satisfies WorkerRequest);
    }
  }, [generation, returnKey, returnMode]);
  const previous = hasEndpoints && !complete && state.geometryKey === geometryKey && state.result ? state : undefined;
  return {
    geometryKey,
    previous,
    result: complete ? state.result : undefined,
    generation,
    inbound: returnMode && generation !== undefined && inbound?.key === returnKey ? inbound.result : undefined,
    acceptedReturnKey: returnMode && generation !== undefined && inbound?.key === returnKey ? returnKey : undefined,
    missionContext,
    requestContext,
    error: complete ? state.error : undefined,
    analysis: complete ? state.analysis : undefined,
    displayAnalysis: complete ? state.analysis ?? state.previousAnalysis : previous?.analysis ?? previous?.previousAnalysis,
    analysisUpdating: !!previous || (complete && !!state.result && !state.analysis),
    analysisError: complete ? state.analysisError : undefined,
    evidence: complete ? state.evidence : undefined,
    displayEvidence: complete ? state.evidence ?? state.previousEvidence : previous?.evidence ?? previous?.previousEvidence,
    evidenceError: complete ? state.evidenceError : undefined,
    rankingPending: !!state.result && complete && (state.comparisonKey !== comparison.key ||
      !state.analysis && !state.analysisError),
    pending: hasEndpoints && !complete,
  };
}
