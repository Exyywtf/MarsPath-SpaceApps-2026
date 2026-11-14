"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PlannerDraft, PlannerSettings } from "./planner";
import type { ClimatePreferences, RouteAnalysis } from "./routeAnalysis";
import type { ComparisonRequest, ComparisonResult, WorkerReply, WorkerRequest } from "./routeProtocol";

type State = {
  geometryKey: string;
  generation?: number;
  result?: ComparisonResult;
  error?: string;
  analysis?: Record<string, RouteAnalysis>;
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
  const geometryKey = JSON.stringify([draft, maxSlope, riskWeight, objectives, geographicOnly, revision]);
  const comparison = useMemo<ComparisonRequest>(() => ({
    key: JSON.stringify([settings.distanceWeight, settings.terrainWeight, settings.scienceWeight, climate]),
    settings,
    climate,
  }), [settings, climate]);
  const input = useRef({ geometryKey, comparison });
  const requestedKey = useRef("");
  const [state, setState] = useState<State>({ geometryKey: "" });
  useLayoutEffect(() => { input.current = { geometryKey, comparison }; }, [geometryKey, comparison]);

  useEffect(() => {
    const w = new Worker("/route-worker.js");
    worker.current = w;
    w.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
      const { geometryKey, comparison } = input.current;
      if (data.id !== requestId.current || geometryKey !== requestedKey.current) return;
      if (data.kind !== "route-error" && data.key !== comparison.key) return;
      if (data.kind === "routes") {
        setState((old) => {
          const sameRoutes = old.generation === data.id &&
            old.result?.routes.length === data.result.routes.length &&
            old.result.routes.every((route, i) => route.id === data.result.routes[i].id);
          return {
            geometryKey, generation: data.id,
            comparisonKey: data.key,
            result: sameRoutes ? { ...data.result, routes: old.result!.routes } : data.result,
            analysis: sameRoutes ? old.analysis : undefined,
          };
        });
      } else if (data.kind === "analysis") {
        setState((old) => old.generation === data.id && old.result ? {
          ...old, result: { ...old.result, scores: data.scores, ranking: data.ranking },
          analysis: data.analysis, analysisError: undefined,
        } : old);
      } else if (data.kind === "analysis-error") {
        setState((old) => old.generation === data.id ? { ...old, analysisError: data.error } : old);
      } else {
        setState({ geometryKey, error: data.error });
      }
    };
    w.onerror = () => setState((old) => ({
      ...old, geometryKey: input.current.geometryKey,
      ...(old.result ? { analysisError: "The route worker stopped." } :
        { error: "The route worker failed. Reload the page to restart it." }),
    }));
    return () => { w.terminate(); worker.current = null; };
  }, []);

  useEffect(() => {
    const id = ++requestId.current;
    requestedKey.current = geometryKey;
    worker.current?.postMessage({ id, kind: "cancel" } satisfies WorkerRequest);
    if (!draft.start || !draft.end) return;
    const timer = setTimeout(() => {
      const comparison = input.current.comparison;
      worker.current?.postMessage({ id, kind: "calculate", draft, settings: comparison.settings, comparison } satisfies WorkerRequest);
    }, 150);
    return () => clearTimeout(timer);
  }, [draft, geometryKey]);

  const compareKey = comparison.key;
  useEffect(() => {
    const id = requestId.current;
    const timer = setTimeout(() => {
      worker.current?.postMessage({ id, kind: "compare", comparison: input.current.comparison } satisfies WorkerRequest);
    }, 90);
    return () => clearTimeout(timer);
  }, [compareKey]);

  const complete = state.geometryKey === geometryKey;
  return {
    result: complete ? state.result : undefined,
    generation: complete && state.result ? state.generation : undefined,
    error: complete ? state.error : undefined,
    analysis: complete ? state.analysis : undefined,
    analysisError: complete ? state.analysisError : undefined,
    rankingPending: !!state.result && complete && (state.comparisonKey !== comparison.key ||
      !state.analysis && !state.analysisError),
    pending: !!draft.start && !!draft.end && !complete,
  };
}
