"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PlannerDraft, PlannerSettings } from "./planner";
import type { ClimatePreferences, RouteAnalysis } from "./routeAnalysis";
import type { ComparisonRequest, ComparisonResult, WorkerReply, WorkerRequest } from "./routeProtocol";
import { matchingRouteAnalyses } from "./routeSnapshot";

type State = {
  geometryKey: string;
  requestKey: string;
  generation?: number;
  result?: ComparisonResult;
  error?: string;
  analysis?: Record<string, RouteAnalysis>;
  previousAnalysis?: Record<string, RouteAnalysis>;
  analysisError?: string;
  comparisonKey?: string;
};

export function useRouteEngine(
  draft: PlannerDraft,
  settings: PlannerSettings,
  revision: number,
  climate: ClimatePreferences,
) {
  const worker = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const { maxSlope, riskWeight, objectives, geographicOnly } = settings;
  const geometryKey = JSON.stringify([draft, maxSlope, riskWeight, objectives, geographicOnly]);
  const requestKey = revision + ":" + geometryKey;
  const comparison = useMemo<ComparisonRequest>(() => ({
    key: JSON.stringify([settings.distanceWeight, settings.terrainWeight, settings.scienceWeight, climate]),
    settings,
    climate,
  }), [settings, climate]);
  const input = useRef({ geometryKey, requestKey, comparison });
  const requestedKey = useRef("");
  const [state, setState] = useState<State>({ geometryKey: "", requestKey: "" });
  useLayoutEffect(() => { input.current = { geometryKey, requestKey, comparison }; }, [geometryKey, requestKey, comparison]);

  useEffect(() => {
    const w = new Worker("/route-worker.js");
    worker.current = w;
    w.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
      const { geometryKey, requestKey, comparison } = input.current;
      if (data.id !== requestId.current || requestKey !== requestedKey.current) return;
      if (data.kind !== "route-error" && data.key !== comparison.key) return;
      if (data.kind === "routes") {
        setState((old) => {
          const sameOrder = old.result?.routes.length === data.result.routes.length &&
            old.result.routes.every((route, i) => route.id === data.result.routes[i].id);
          const sameRoutes = old.generation === data.id && sameOrder;
          const retained = old.geometryKey === geometryKey
            ? matchingRouteAnalyses(old.result, data.result, old.analysis ?? old.previousAnalysis)
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
          };
        });
      } else if (data.kind === "analysis") {
        setState((old) => old.generation === data.id && old.result ? {
          ...old, result: { ...old.result, scores: data.scores, ranking: data.ranking },
          analysis: data.analysis, previousAnalysis: undefined, analysisError: undefined,
        } : old);
      } else if (data.kind === "analysis-error") {
        setState((old) => old.generation === data.id ? { ...old, analysisError: data.error } : old);
      } else {
        setState({ geometryKey, requestKey, error: data.error });
      }
    };
    w.onerror = () => setState((old) => {
      const { geometryKey, requestKey } = input.current;
      return old.requestKey === requestKey && old.result
        ? { ...old, analysisError: "The route worker stopped." }
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
    const id = requestId.current;
    const timer = setTimeout(() => {
      worker.current?.postMessage({ id, kind: "compare", comparison: input.current.comparison } satisfies WorkerRequest);
    }, 90);
    return () => clearTimeout(timer);
  }, [compareKey]);

  const complete = state.requestKey === requestKey;
  const previous = !complete && state.geometryKey === geometryKey && state.result ? state : undefined;
  return {
    geometryKey,
    previous,
    result: complete ? state.result : undefined,
    generation: complete && state.result ? state.generation : undefined,
    error: complete ? state.error : undefined,
    analysis: complete ? state.analysis : undefined,
    displayAnalysis: complete ? state.analysis ?? state.previousAnalysis : previous?.analysis ?? previous?.previousAnalysis,
    analysisUpdating: !!previous || (complete && !!state.result && !state.analysis),
    analysisError: complete ? state.analysisError : undefined,
    rankingPending: !!state.result && complete && (state.comparisonKey !== comparison.key ||
      !state.analysis && !state.analysisError),
    pending: !!draft.start && !!draft.end && !complete,
  };
}
