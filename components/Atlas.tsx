"use client";
import EvidenceLink from "./EvidenceLink";
import Accordion from "./Accordion";
import dynamic from "next/dynamic";
import Link from "next/link";
import DestinationGallery from "./DestinationGallery";
import { destinationGallery } from "@/lib/gallery";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Crosshair,
  HelpCircle,
  Layers,
  LoaderCircle,
  Minus,
  Mountain,
  Plus,
  Route,
  Search,
  X,
} from "lucide-react";
import { locations, asLonLat, destinationZoom, locationFromSearch } from "@/lib/atlas";
import { coordinateLabel, type LonLat } from "@/lib/mars";
import {
  defaultSettings,
  emptyDraft,
  routeAppearance,
  type EndpointKind,
  type PlannerDraft,
  type Placement,
} from "@/lib/planner";
import { useRouteEngine } from "@/lib/useRouteEngine";
import type { RemovablePointKind } from "@/lib/endpointGestures";
import { emptyMission, jezeroMissionExample, type MissionAssumptions, type MissionObjective } from "@/lib/missionPlan";
import { rankAcceptedCandidates } from "@/lib/routeRanking";
import { useMapLayout } from "@/lib/useMapLayout";
import { useResultsReveal } from "@/lib/useResultsReveal";
import { defaultClimatePreferences } from "@/lib/routeAnalysis";
import type { MapHandle, MapInsets, MapMissionMarker, MapRoute } from "./MarsMap";
import RoutePlanner, { terrainMetadata } from "./RoutePlanner";
import { oxiaTerrain, regionalTerrains } from "@/lib/terrainRegistry";
import regions from "@/data/regions.json";
import { scientificLayers, layerValue, type LayerId } from "@/lib/layers";
import type { OverlayState } from "@/lib/scientificOverlay";
import { useLayerData } from "@/lib/useLayerData";
import { mineralStyles } from "@/lib/explorationScience";
import LayerManager, { LayerLegend } from "./LayerManager";
import AtlasHelp from "./AtlasHelp";
import ScrollArea from "./ScrollArea";
import type { DialogHandle } from "./AtlasDialog";
import HeaderLinks from "./HeaderLinks";
import { MissionJourney, MissionSensitivity, MissionSetup, missionPresets, type MissionPreset } from "./MissionPlanner";
import { CommunicationsSetup, MissionConditions } from "./MissionConditions";
import { downloadMission, openMissionBrief, type MissionBrief } from "@/lib/missionBrief";
import HistoricalObservations from "./HistoricalObservations";
const MarsMap = dynamic(() => import("./MarsMap"), {
  ssr: false,
  loading: () => (
    <div className="map-loading" role="status">
      Loading the Mars atlas…
    </div>
  ),
});
type Workflow = "places" | "layers" | "directions" | "mission" | "location";
type Panel = Workflow | null;
const noMapRoutes: MapRoute[] = [];
const allTerrainBounds = regionalTerrains.map(({ bounds }) => bounds);
const CoordinateReadout = memo(
  forwardRef<{ set: (s: string) => void }>(function CoordinateReadout(_, ref) {
    const [text, setText] = useState("Planetocentric · east-positive");
    useImperativeHandle(ref, () => ({ set: setText }), []);
    return <span className="footer-coord">{text}</span>;
  }),
);
export default function Atlas() {
  const [scienceSections, setScienceSections] = useState({ objectives: false, outcrops: false });
  const [scienceFocus, setScienceFocus] = useState<{ id: string; revision: number } | null>(null);
  const map = useRef<MapHandle>(null),
    mapInitialized = useRef(false),
    pendingFocus = useRef<((target: MapHandle) => void) | null>(null),
    focusFrame = useRef(0),
    readout = useRef<{ set: (s: string) => void }>(null),
    panelRef = useRef<HTMLElement>(null),
    headerRef = useRef<HTMLElement>(null),
    footerRef = useRef<HTMLElement>(null),
    controlsRef = useRef<HTMLDivElement>(null),
    locationScroll = useRef<HTMLDivElement>(null),
    searchRef = useRef<HTMLInputElement>(null),
    help = useRef<DialogHandle>(null),
    helpButton = useRef<HTMLButtonElement>(null);
  const [{ panel, lastPanel, visited, leaving }, setWorkflow] = useState<{
    panel: Panel; lastPanel: Workflow; visited: ReadonlySet<Workflow>;
    leaving: { id: Workflow } | null;
  }>(() => ({ panel: "places", lastPanel: "places", visited: new Set(["places"]), leaving: null }));
  const visiblePanel = panel ?? lastPanel;
  const switchPanel = useCallback((next: Panel) => {
    const animate = next && panel && next !== panel && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    setWorkflow((current) => current.panel === next ? current : {
      panel: next,
      lastPanel: next ?? current.lastPanel,
      visited: next && !current.visited.has(next) ? new Set([...current.visited, next]) : current.visited,
      leaving: animate ? { id: panel } : null,
    });
  }, [panel]);
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setWorkflow((current) => ({ ...current, leaving: null })), 160);
    return () => clearTimeout(timer);
  }, [leaving]);
  const [selected, setSelected] = useState<string | null>(null),
    [sheet, setSheet] = useState<"peek" | "half" | "full">("half");
  const [draft, setDraft] = useState<PlannerDraft>(emptyDraft),
    [settings, setSettings] = useState(defaultSettings),
    [placement, setPlacement] = useState<Placement>(null),
    [revision, setRevision] = useState(0),
    [removalRevision, setRemovalRevision] = useState(0),
    [removedPoint, setRemovedPoint] = useState<RemovablePointKind | null>(null),
    [active, setActive] = useState<{ geometryKey: string; id: string } | null>(null),
    [drawing, setDrawing] = useState(false),
    [hideFeatured, setHideFeatured] = useState(false);
  const [climatePreferences, setClimatePreferences] = useState(defaultClimatePreferences);
  const [mission, setMission] = useState<MissionAssumptions>(emptyMission);
  const [preset, setPreset] = useState<MissionPreset>();
  const [showStudy, setShowStudy] = useState(false);
  const [showTerminator, setShowTerminator] = useState(false);
  const [showVisibility, setShowVisibility] = useState(false);
  const updateMission = useCallback((patch: Partial<MissionAssumptions>) => setMission((old) => ({ ...old, ...patch })), []);
  const changeObjective = useCallback((objective: MissionObjective) => {
    updateMission({ objective });
    setSettings((old) => ({ ...old, objectives: objective === "ancient-water" || objective === "sedimentary" ? [objective] : [] }));
  }, [updateMission]);
  const [query, setQuery] = useState(""),
    [tag, setTag] = useState("All"),
    [basemap, setBasemap] = useState("optical"),
    [topography, setTopography] = useState(false),
    [opacity, setOpacity] = useState(0.50),
    [showLocations, setShowLocations] = useState(true);
  const [imagery, setImagery] = useState("Viking · 232 m mosaic"),
    [mapReady, setMapReady] = useState(false),
    [scale, setScale] = useState(""),
    [tileState, setTileState] = useState<boolean | null>(null);
  const [shortcuts, setShortcuts] = useState(true),
    [keyboardHelp, setKeyboardHelp] = useState(false),
    [onboarding, setOnboarding] = useState(false),
    [preferencesReady, setPreferencesReady] = useState(false);
  const [layerId, setLayerId] = useState<LayerId | null>(null),
    [layerOpacity, setLayerOpacity] = useState(0.75),
    [overlay, setOverlay] = useState<OverlayState>({ active: null, phase: "idle", message: "Choose a field to inspect" }),
    [layerRetry, setLayerRetry] = useState(0),
    [inspectionAnchor, setInspectionAnchor] = useState<{ point: LonLat; observationIds?: string[] } | null>(null);
  const inspectPoint = inspectionAnchor?.point ?? null;
  const inspect = useCallback((point: LonLat, observationIds?: string[]) => setInspectionAnchor({ point, observationIds }), []);
  const requestedLayer = scientificLayers.find((l) => l.id === layerId) ?? null;
  const layer = scientificLayers.find((l) => l.id === overlay.active) ?? null,
    inspection = useLayerData(layer, inspectPoint, inspectionAnchor?.observationIds);
  const engine = useRouteEngine(draft, settings, revision, climatePreferences, removalRevision, mission.returnMode);
  const baseResult = engine.result ?? engine.previous?.result;
  const result = useMemo(() => panel === "mission" && preset && baseResult
    ? { ...baseResult, ...rankAcceptedCandidates(baseResult.routes, { ...settings, ...missionPresets[preset] },
        climatePreferences, baseResult.ranking.climate) }
    : baseResult, [panel, preset, baseResult, settings, climatePreferences]);
  const updating = !!engine.previous;
  const [calculationSlow, setCalculationSlow] = useState(false);
  const [dismissedError, setDismissedError] = useState<string>();
  useEffect(() => {
    const timer = window.setTimeout(() => setCalculationSlow(engine.pending), engine.pending ? 150 : 0);
    return () => window.clearTimeout(timer);
  }, [engine.pending]);
  const routeFeedback = engine.pending && calculationSlow ? "calculating" :
    !engine.pending && drawing ? "drawing" :
      engine.error && dismissedError !== engine.error ? "error" : null;
  const updateDrawing = useCallback((next: boolean) => {
    if (!next && document.activeElement?.matches(".route-feedback > button"))
      document.getElementById("interactive-mars-map")?.focus({ preventScroll: true });
    setDrawing(next);
  }, []);
  const setProfilePoint = useCallback((point: LonLat | null) => map.current?.showProfilePoint(point), []);
  const expandResults = useCallback(() => setSheet((old) => old === "peek" ? "half" : old), []);
  const [attachScroll, collapsed, interruptScroll, viewResults, editRoute, openEditors] = useResultsReveal({
    pending: engine.pending, generation: engine.generation,
    draftKey: engine.geometryKey,
    directions: panel === "directions" || panel === "mission", placement, expand: expandResults,
  });
  const location = locations.find((l) => l.id === selected);
  const filtered = locations.filter(
    (l) =>
      (tag === "All" || l.tags.includes(tag)) &&
      (l.name + " " + l.summary + " " + l.tags.join(" "))
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => {
      if (!alive) return;
      const linked = locationFromSearch(window.location.search);
      const params = new URLSearchParams(window.location.search);
      const linkedMission = params.get("mission") === "jezero";
      const linkedHelp = params.get("help") === "1";
      if (linkedMission) {
        setWorkflow((old) => ({ panel: "mission", lastPanel: "mission", visited: new Set([...old.visited, "mission"]), leaving: null }));
      } else if (linked) {
        setSelected(linked.id);
        setWorkflow((old) => ({ panel: "location", lastPanel: "location", visited: new Set([...old.visited, "location"]), leaving: null }));
      }
      try {
        setShortcuts(localStorage.getItem("marspath-shortcuts") !== "off");
        setOnboarding(!linked && !linkedMission && !linkedHelp && !localStorage.getItem("marspath-onboarded"));
      } catch {}
      if (linkedHelp) help.current?.open(helpButton.current);
      setPreferencesReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (preferencesReady)
      try {
        localStorage.setItem("marspath-shortcuts", shortcuts ? "on" : "off");
      } catch {}
  }, [shortcuts, preferencesReady]);
  const open = useCallback((next: Panel) => {
    switchPanel(next);
    setPlacement(null);
    setSheet((current) => current === "peek" ? "half" : current);
    setOnboarding(false);
    try {
      localStorage.setItem("marspath-onboarded", "1");
    } catch {}
  }, [switchPanel]);
  const openDirections = useCallback(() => open("directions"), [open]);
  const place = useCallback(
    (point: LonLat) => {
      if (placement === "station") {
        updateMission({ station: point });
        expandResults();
        setPlacement(null);
        return;
      }
      setDraft((old) =>
        placement === "start"
          ? { ...old, start: point }
          : placement === "end"
            ? { ...old, end: point }
            : placement === "waypoint" && old.waypoints.length < 3
              ? { ...old, waypoints: [...old.waypoints, point] }
              : old,
      );
      if (placement === "waypoint") expandResults();
      setPlacement(null);
    },
    [expandResults, placement, updateMission],
  );
  const pick = useCallback(
    (p: Placement) => {
      if (p && !mapReady) return;
      setPlacement(p);
      switchPanel(panel === "mission" ? "mission" : "directions");
      setSheet(p ? "peek" : "half");
      setOnboarding(false);
      if (p)
        document
          .getElementById("interactive-mars-map")
          ?.focus({ preventScroll: true });
    },
    [mapReady, panel, switchPanel],
  );
  const mapDidInitialize = useCallback(() => {
    mapInitialized.current = true;
    setMapReady(true);
    const focus = pendingFocus.current;
    if (focus) {
      pendingFocus.current = null;
      if (map.current) focus(map.current);
    }
  }, []);
  const moveCamera = useCallback((action: (target: MapHandle) => void) => {
    cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => {
      if (map.current && mapInitialized.current) action(map.current);
      else pendingFocus.current = action;
    });
  }, []);
  useEffect(() => () => cancelAnimationFrame(focusFrame.current), []);
  const movePoint = useCallback(
    (kind: RemovablePointKind | number, point: LonLat) => {
      if (kind === "station") {
        updateMission({ station: point });
        return;
      }
      setDraft((old) =>
        typeof kind === "number"
          ? {
              ...old,
              waypoints: old.waypoints.map((p, i) => (i === kind ? point : p)),
            }
          : old[kind] ? { ...old, [kind]: point } : old,
      );
    },
    [updateMission],
  );
  const removeEndpoint = useCallback((kind: EndpointKind) => {
    if (!draft[kind]) return;
    interruptScroll();
    setDraft((old) => ({ ...old, [kind]: null }));
    setRemovalRevision((old) => old + 1);
    setRemovedPoint(kind);
    setPlacement(null);
    setDrawing(false);
    setDismissedError(undefined);
    setProfilePoint(null);
  }, [draft, interruptScroll, setProfilePoint]);
  const removeStation = useCallback(() => {
    updateMission({ station: null });
    setRemovedPoint("station");
    setPlacement((current) => current === "station" ? null : current);
  }, [updateMission]);
  const select = useCallback(
    (id: string) => {
      const l = locations.find((l) => l.id === id);
      if (!l) return;
      setOnboarding(false);
      if (placement) {
        place(asLonLat(l.coordinates));
        switchPanel(panel === "mission" ? "mission" : "directions");
        return;
      }
      switchPanel("location");
      setSelected(id);
      setSheet("half");
      const point = asLonLat(l.coordinates);
      const zoom = destinationZoom(id);
      moveCamera((target) => target.focus(point, zoom));
    },
    [moveCamera, panel, placement, place, switchPanel],
  );
  const setCoordinate = useCallback(
    (label: string) => readout.current?.set(label),
    [],
  );
  const example = useCallback(() => {
    setDraft({
      start: terrainMetadata.examples[0][0] as LonLat,
      end: terrainMetadata.examples[0][1] as LonLat,
      waypoints: [],
    });
    setSettings((old) => ({ ...old, geographicOnly: false }));
    setPlacement(null);
    setSheet("half");
    moveCamera((target) => target.focus([77.44, 18.46], 11));
  }, [moveCamera]);
  const missionExample = useCallback(() => {
    open("mission");
    setMission(jezeroMissionExample);
    setSettings({ ...defaultSettings, objectives: ["ancient-water"] });
    setClimatePreferences(defaultClimatePreferences);
    setDraft({ start: asLonLat(terrainMetadata.examples[0][0]), end: asLonLat(terrainMetadata.examples[0][1]), waypoints: [] });
    setPreset(undefined);
    setActive(null);
    moveCamera((target) => target.focus([77.44, 18.46], 11));
  }, [open, moveCamera]);
  const featureJezero = useCallback((directions: boolean) => {
    open(directions ? "directions" : "location");
    setSelected("jezero");
    const [west, south, east, north] = terrainMetadata.bounds;
    const focus = (target: MapHandle) => target.fitRoute([[west, south], [east, north]]);
    moveCamera(focus);
  }, [moveCamera, open]);
  const featureOxia = useCallback((withExample: boolean) => {
    if (withExample) {
      setDraft({ start: asLonLat(oxiaTerrain.examples[0][0]), end: asLonLat(oxiaTerrain.examples[0][1]), waypoints: [] });
      setSettings({ ...defaultSettings, objectives: [] });
      setClimatePreferences(defaultClimatePreferences);
      setPlacement(null);
    }
    open("directions");
    const [west, south, east, north] = oxiaTerrain.bounds;
    moveCamera((target) => target.fitRoute([[west, south], [east, north]]));
  }, [moveCamera, open]);
  const candidates = result?.routes;
  const scores = result?.scores;
  const recommended = scores ? scores.indexOf(Math.min(...scores)) : -1;
  const manual = active && active.geometryKey === engine.geometryKey && candidates
    ? candidates.findIndex((route) => route.id === active.id) : -1;
  const selectedIndex = manual >= 0 ? manual : Math.max(0, recommended);
  const selectedRoute = engine.result?.routes[selectedIndex];
  const inbound = engine.inbound?.status === "ready" ? engine.inbound.route : undefined;
  const { speedKmh, dwellMinutes, departure, returnMode, station, stationHeightM, observerHeightM } = mission;
  const parameters = useMemo(() => ({ speedKmh, dwellMinutes, departure, returnMode, station, stationHeightM, observerHeightM }),
    [speedKmh, dwellMinutes, departure, returnMode, station, stationHeightM, observerHeightM]);
  const { generation, acceptedReturnKey, requestContext } = engine;
  const readyForContext = !!(departure || station || returnMode);
  const selectedId = selectedRoute?.id;
  const contextKey = selectedId && generation !== undefined && readyForContext
    ? JSON.stringify([generation, selectedId, acceptedReturnKey, parameters]) : "";
  const lastContextKey = useRef("");
  useEffect(() => {
    const previousKey = lastContextKey.current;
    lastContextKey.current = contextKey;
    if (generation === undefined || (!contextKey && !previousKey)) return;
    requestContext({ kind: "mission-context", id: generation, key: contextKey, routeId: selectedId,
      parameters: contextKey ? parameters : undefined, returnKey: acceptedReturnKey });
  }, [contextKey, generation, selectedId, parameters, acceptedReturnKey, requestContext]);
  const missionContext = contextKey && engine.missionContext?.key === contextKey ? engine.missionContext.result : undefined;
  const contextPending = Boolean(contextKey && !missionContext);
  const mapRoutes = useMemo<MapRoute[]>(() => {
    if (updating || !candidates) return noMapRoutes;
    const routes: MapRoute[] = candidates.map((route, index) => ({
      id: route.id,
      coordinates: route.coordinates,
      ...routeAppearance(index, recommended, route.tier === "geographic"),
      selected: index === selectedIndex,
      connectors: route.connectors,
    }));
    if (panel === "mission" && inbound)
      routes.push({ id: inbound.id, coordinates: inbound.coordinates, color: "#75d4c4", dash: [8, 7],
        selected: true, connectors: inbound.connectors });
    if (panel === "mission" && showTerminator && missionContext?.daylight?.terminator)
      missionContext.daylight.terminator.forEach((coordinates, i) => routes.push({
        id: "solar-terminator-" + i, coordinates, color: "#e8d9f7", dash: [4, 6], selected: false,
      }));
    return routes;
  }, [candidates, inbound, missionContext, panel, recommended, selectedIndex, showTerminator, updating]);
  const missionMarkers = useMemo<MapMissionMarker[]>(() => {
    if (panel !== "mission") return [];
    return showVisibility
      ? [missionContext?.visibility?.outbound, missionContext?.visibility?.return].flatMap((record) =>
          record?.samples.map(({ point, status }) => ({ point, status })) ?? [])
      : [];
  }, [missionContext, panel, showVisibility]);
  function makeBrief(): MissionBrief | undefined {
    if (generation === undefined || !selectedRoute || !engine.result) return;
    const analysis = engine.analysis?.[selectedRoute.id], evidence = engine.evidence?.[selectedRoute.id];
    return {
      requestId: generation, geometryKey: engine.geometryKey, generatedAt: new Date().toISOString(),
      mission, draft, settings, terrain: engine.result.meta, selected: selectedRoute, candidates: engine.result.routes,
      ranking: engine.rankingPending ? undefined : result?.ranking, scores: engine.rankingPending ? undefined : result?.scores,
      inbound: engine.inbound, analysis, evidence, context: missionContext,
      analysisStatus: analysis ? "ready" : engine.analysisError ? "unavailable" : "pending",
      evidenceStatus: evidence ? "ready" : engine.evidenceError ? "unavailable" : "pending",
      contextStatus: contextPending ? "pending" : missionContext && !missionContext.error ? "ready" : "unavailable",
    };
  }
  const endMapFeedback = () => {
    if (routeFeedback === "drawing") map.current?.finishReveal();
    if (routeFeedback === "error") setDismissedError(engine.error);
    document.getElementById("interactive-mars-map")?.focus({ preventScroll: true });
  };
  useEffect(() => {
    map.current?.showProfilePoint(null);
  }, [engine.generation, selectedIndex, panel]);
  const { root: atlasRef, read: getLayout, measure: measureLayout } = useMapLayout(
    [panel, sheet, layer?.id, inspectPoint?.join(","), routeFeedback, placement].join("|"),
    () => map.current?.refreshLayout());
  const getMapInsets = useCallback((): MapInsets => measureLayout().insets, [measureLayout]);
  useLayoutEffect(() => {
    map.current?.rememberInsets();
  }, [panel, sheet]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        e.isComposing ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        document.querySelector("dialog[open]")
      )
        return;
      if (e.key === "Escape") {
        if (placement) {
          setPlacement(null);
          setSheet("half");
        } else {
          switchPanel(null);
          document.querySelector<HTMLElement>(".nav-explore")?.focus();
        }
        return;
      }
      if (
        target.closest('input,textarea,select,[contenteditable="true"]') ||
        !shortcuts
      )
        return;
      const k = e.key.toLowerCase();
      if (k === "/") {
        e.preventDefault();
        open("places");
        requestAnimationFrame(() => searchRef.current?.focus());
      } else if (k === "l") open("layers");
      else if (k === "r") openDirections();
      else if (k === "a") pick("start");
      else if (k === "b") pick("end");
      else if (k === "?") {
        e.preventDefault();
        setKeyboardHelp(true);
        help.current?.open();
      } else if ((k === "+" || k === "-") && target.closest(".map-canvas")) {
        e.preventDefault();
        map.current?.zoomBy(k === "+" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [shortcuts, open, openDirections, pick, placement, switchPanel]);
  function dismissOnboarding() {
    setOnboarding(false);
    try {
      localStorage.setItem("marspath-onboarded", "1");
    } catch {}
  }
  useLayoutEffect(() => {
    if (panel && !placement && document.activeElement !== document.body)
      document.getElementById("workflow-title")?.focus({ preventScroll: true });
  }, [panel, placement]);
  useLayoutEffect(() => {
    if (locationScroll.current) locationScroll.current.scrollTop = 0;
  }, [selected]);
  useLayoutEffect(() => {
    const nav = headerRef.current?.querySelector("nav");
    if (!nav) return;
    const measure = () => {
      const active = nav.querySelector<HTMLElement>('[aria-pressed="true"]');
      nav.style.setProperty("--tab-visible", active ? "1" : "0");
      if (!active) return;
      nav.style.setProperty("--tab-x", active.offsetLeft + "px");
      nav.style.setProperty("--tab-width", active.offsetWidth + "px");
    };
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    measure();
    return () => observer.disconnect();
  }, [panel]);
  function workflowState(id: Workflow) {
    const active = visiblePanel === id || id === "directions" && visiblePanel === "mission";
    const exiting = !active && (leaving?.id === id || id === "directions" && leaving?.id === "mission");
    return {
      "data-active": active,
      inert: !active,
      "aria-hidden": !active || undefined,
      "data-leaving": exiting,
    };
  }
  const dragStart = useRef(0);
  const title =
    visiblePanel === "places"
      ? "Explore Mars"
      : visiblePanel === "layers"
        ? "Map layers"
        : visiblePanel === "directions"
          ? "Directions"
          : visiblePanel === "mission" ? "Mission Planner" : (location?.name ?? "Destination");
  return (
    <main className="atlas page-view" ref={atlasRef}>
      <a className="skip-link" href="#workflow-panel">
        Skip to controls
      </a>
      <a className="skip-link skip-map" href="#interactive-mars-map">
        Skip to map
      </a>
      <header className="topbar" ref={headerRef}>
        <Link className="brand" href="/" aria-label="MarsPath home">
          <span className="brand-orbit" />
          MarsPath
        </Link>
        <nav aria-label="Atlas tools">
          <button
            className={
              "nav-explore" + (panel === "places" ? " nav-active" : "")
            }
            aria-pressed={panel === "places"}
            onClick={() => open("places")}
          >
            <Search size={18} />
            <span>Explore</span>
          </button>
          <button
            className={panel === "directions" ? "nav-active" : ""}
            aria-pressed={panel === "directions"}
            onClick={openDirections}
          >
            <Route size={18} />
            <span>Directions</span>
          </button>
          <button className={panel === "mission" ? "nav-active mission-tab" : "mission-tab"}
            aria-label="Mission Planner" aria-pressed={panel === "mission"} onClick={() => open("mission")}>
            <Compass size={18} aria-hidden="true" /><span className="mission-tab-full">Mission Planner</span>
            <span className="mission-tab-compact">Mission</span>
          </button>
          <button
            className={panel === "layers" ? "nav-active" : ""}
            aria-pressed={panel === "layers"}
            onClick={() => open("layers")}
          >
            <Layers size={18} />
            <span>Layers</span>
          </button>
        </nav>
        <HeaderLinks help={
          <button
            ref={helpButton}
            aria-label="Help and keyboard shortcuts"
            title="Help"
            onClick={(event) => {
              setKeyboardHelp(event.detail === 0);
              help.current?.open(event.currentTarget);
            }}
          >
            <HelpCircle size={19} />
            <span>Help</span>
          </button>
        } />
      </header>
      <span className="sr-only" role="status" aria-atomic="true">
        {removedPoint === "station" ? !station && "Communications station removed."
          : removedPoint && !draft[removedPoint] && `Point ${removedPoint === "start" ? "A" : "B"} removed.`}
      </span>
      <section className="map-area" id="mars-map">
        <MarsMap
          ref={map}
          selected={selected}
          basemap={basemap}
          topography={topography}
          opacity={opacity}
          showLocations={showLocations}
          onSelect={select}
          onCoordinate={setCoordinate}
          onImagery={setImagery}
          onTileState={setTileState}
          onReady={mapDidInitialize}
          onScale={setScale}
          draft={draft}
          placement={placement}
          onPlace={place}
          onMovePoint={movePoint}
          onRemoveEndpoint={removeEndpoint}
          station={panel === "mission" ? station : null}
          onRemoveStation={removeStation}
          routes={mapRoutes}
          missionMarkers={missionMarkers}
          routeGeneration={engine.generation}
          recommendedRoute={mapRoutes[recommended]?.id}
          onRevealState={updateDrawing}
          terrainBounds={allTerrainBounds}
          getInsets={getMapInsets}
          getLayout={getLayout}
          layer={requestedLayer}
          layerOpacity={layerOpacity}
          layerRetry={layerRetry}
          onLayerState={setOverlay}
          onInspect={inspect}
          showScience={panel === "directions" || panel === "mission" || settings.objectives.length > 0}
          onScienceSelect={(id) => {
            openDirections();
            openEditors();
            setScienceSections({ objectives: true, outcrops: true });
            setScienceFocus((old) => ({ id, revision: (old?.revision ?? 0) + 1 }));
          }}
        />
        <div className="route-feedback" data-visible={!!routeFeedback}>
          {routeFeedback === "calculating" && (
            <span aria-hidden="true"><LoaderCircle size={17} /> Calculating routes…</span>
          )}
          {routeFeedback === "drawing" && (
            <button onClick={endMapFeedback}>Skip reveal</button>
          )}
          {routeFeedback === "error" && (
            <div className="route-feedback-error">
              <span>{engine.error}</span>
              <button className="icon-button" aria-label="Dismiss route error" onClick={endMapFeedback}><X size={16} /></button>
            </div>
          )}
        </div>
        <div className="imagery-label">
          <span className="status-dot" />
          {imagery}
        </div>
        {placement && (
          <div
            className="placement-instruction"
            id="placement-instruction"
            role="status"
          >
            <Crosshair size={18} />
            <span>
              {placement === "station" ? "communications station" : placement === "waypoint"
                ? "Choose a waypoint"
                : "Choose " +
                  (placement === "start" ? "A · start" : "B · destination")}
              <small>
                Click the map, or move with arrow keys and press Enter.
              </small>
            </span>
            <button
              aria-label="Cancel point placement"
              className="icon-button"
              onClick={() => {
                setPlacement(null);
                setSheet("half");
              }}
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="map-controls" ref={controlsRef}>
          <button
            aria-label="Zoom in"
            disabled={!mapReady}
            onClick={() => map.current?.zoomBy(1)}
          >
            <Plus size={19} />
          </button>
          <button
            aria-label="Zoom out"
            disabled={!mapReady}
            onClick={() => map.current?.zoomBy(-1)}
          >
            <Minus size={19} />
          </button>
          <button
            aria-label="Recenter global map"
            disabled={!mapReady}
            onClick={() => {
              setSheet((old) => old === "full" ? "half" : old);
              moveCamera((target) => target.reset());
            }}
          >
            <Compass size={19} />
          </button>
        </div>
        {tileState === false && (
          <div className="service-warning" role="status">
            Some NASA imagery could not load. Local numerical planning remains
            available.
          </div>
        )}
        {layer && !placement && (
          <div className="map-legend" key={layer.id} data-hiding={overlay.phase === "hiding"}>
            <strong>{layer.name}</strong>
            <LayerLegend layer={layer} compact />
            <span>{layer.kind}</span>
          </div>
        )}
        {layer && inspectPoint && !placement && overlay.phase !== "hiding" && (
          <aside
            className="inspection-card"
            data-categorical={layer.presentation === "categorical" || layer.presentation === "observations" || layer.presentation === "coverage"}
            aria-label="Scientific value inspection"
          >
            <button
              className="icon-button"
              aria-label="Close value inspection"
              onClick={() => setInspectionAnchor(null)}
            >
              <X size={16} />
            </button>
            <span>{layer.name}</span>
            <strong aria-live="polite" aria-atomic="true">
              {inspection.loading
                ? "Loading…"
                : layer.presentation === "historical"
                  ? inspection.covered ? "Historical image coverage" : "Outside historical image coverage"
                  : layer.presentation === "categorical"
                  ? inspection.unit ? `${inspection.unit.code} · ${inspection.unit.name}` : "No mapped unit"
                  : layer.presentation === "coverage"
                  ? inspection.coverage?.tier === "regional" ? "Regional terrain" : inspection.coverage?.tier === "coarse" ? "Coarse MOLA terrain" : "Numerical terrain unavailable"
                  : layer.presentation === "observations"
                  ? inspection.observations.length
                    ? `${inspection.observations.length} published record${inspection.observations.length === 1 ? "" : "s"}`
                    : "No marker at this point"
                  : inspection.value === null
                  ? "No numerical value"
                  : layerValue(inspection.value, layer.id) + " " + layer.unit}
            </strong>
            <p>{coordinateLabel(inspectPoint)}</p>
            <small>
              {layer.id === "topography"
                ? "Interpolated cell-average elevation"
                : layer.presentation === "historical" ? "NASA 2002 illustration; no point dose values"
                  : layer.presentation === "categorical" ? inspection.unit ? `USGS polygon ${inspection.unit.featureId} · 0.125° derivative cell` : layer.sampling
                    : layer.presentation === "observations" ? "Catalogue locations · overlap varies with zoom"
                      : layer.presentation === "coverage" ? "Grid validity · alignment accuracy is unknown"
                      : layer.id === "thermal-inertia" ? "TES nightside estimate · 0.25° area-weighted cell"
                  : layer.id === "radiation" ? "Modelled effective dose rate · 700 MV research scenario"
                    : layer.id === "radiation-column" ? "Vertical atmospheric column mass, not a dose estimate"
                      : "Interpolated modelled climatology"}
            </small>
            {inspection.coverage && <ul className="inspection-records">
              {inspection.coverage.meta && <li>
                <span>{inspection.coverage.meta.name} · {inspection.coverage.meta.angularStep ? `${inspection.coverage.meta.angularStep}°` : `${inspection.coverage.meta.pixelSize} m projected`}</span>
                <EvidenceLink href={inspection.coverage.meta.sourcePage} target="_blank" rel="noreferrer">Terrain source</EvidenceLink>
              </li>}
              <li><span>MCD scenario · {inspection.coverage.climate ? "available" : "unavailable"}</span>
                <span>Radiation model · {inspection.coverage.radiation ? "available" : "unavailable"}</span>
                <span>{inspection.coverage.targets.length ? inspection.coverage.targets.join(", ") : "Published outcrop cell · none here"}</span>
              </li>
            </ul>}
            {!!inspection.observations.length && <ul className="inspection-records">
              {inspection.observations.map((item) => (
                <li key={`${item.kind}:${item.id}`}>
                  <strong>{mineralStyles[item.kind].label}</strong>
                  {item.kind === "hydrated" ? <>
                    <span>{coordinateLabel(item.point, 2)}</span>
                    {item.omegaProduct && <span>ESA Mars Express · OMEGA · {item.omegaProduct}</span>}
                    {item.crismProduct && <span>NASA MRO · CRISM · {item.crismProduct}</span>}
                    <span>PDS {item.sourceRows.length === 1 ? "row" : "rows"} {item.sourceRows.join(", ")} · species unspecified</span>
                  </> : <>
                    <span>{item.kind === "crism" ? item.interpretation : item.label}</span>
                    <span>{mineralStyles[item.kind].instrument} · {item.id}</span>
                  </>}
                  <EvidenceLink href={mineralStyles[item.kind].source} target="_blank" rel="noreferrer">Catalogue source</EvidenceLink>
                </li>
              ))}
            </ul>}
            {layer.presentation === "observations"
              ? <EvidenceLink href="/methodology/#exploration-science">Catalogue methods</EvidenceLink>
              : <EvidenceLink href={layer.sourcePage} target="_blank" rel="noreferrer">Source & context</EvidenceLink>}
          </aside>
        )}
        <footer className="map-footer" ref={footerRef}>
          <CoordinateReadout ref={readout} />
          <span className="scale-indicator">
            <i />
            {scale} / 100 px
          </span>
          <EvidenceLink
            href="https://trek.nasa.gov/mars/"
            compactLabel="NASA / USGS"
            aria-label="NASA / JPL / USGS · Mars Trek"
            target="_blank"
            rel="noreferrer"
          >
            NASA / JPL / USGS · Mars Trek</EvidenceLink>
        </footer>
      </section>
        <aside
          id="workflow-panel"
          tabIndex={-1}
          ref={panelRef}
          data-open={!!panel}
          inert={!panel}
          aria-hidden={!panel || undefined}
          className={
            "workflow-panel sheet-" +
            sheet +
            (visiblePanel === "directions" ? " directions-panel" : "") +
            (visiblePanel === "mission" ? " mission-panel" : "") +
            (visiblePanel === "location" ? " detail-panel" : "")
          }
          aria-label={title}
        >
          <div className="workflow-header">
            <div
              className="sheet-grip"
              onPointerDown={(e) => {
                if ((e.target as Element).closest("button")) return;
                interruptScroll();
                dragStart.current = e.clientY;
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerUp={(e) => {
                if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                e.currentTarget.releasePointerCapture(e.pointerId);
                const delta = e.clientY - dragStart.current;
                if (Math.abs(delta) > 30)
                  setSheet(
                    delta > 0
                      ? sheet === "full"
                        ? "half"
                        : "peek"
                      : sheet === "peek"
                        ? "half"
                        : "full",
                  );
              }}
            >
              <span />
              <button className="text-button show-map" onClick={() => {
                interruptScroll(); setSheet("half");
                requestAnimationFrame(() => document.getElementById("interactive-mars-map")?.focus({ preventScroll: true }));
              }}>Show map</button>
              <div className="sheet-buttons">
                <button className="icon-button" aria-label={sheet === "peek" ? "Expand panel" : "Collapse panel"}
                  onClick={() => { interruptScroll(); setSheet(sheet === "peek" ? "half" : "peek"); }}>
                  {sheet === "peek" ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
                </button>
                <button className="icon-button" aria-label={sheet === "full" ? "Reduce panel" : "Expand panel fully"}
                  onClick={() => { interruptScroll(); setSheet(sheet === "full" ? "half" : "full"); }}>
                  <ChevronUp size={19} />
                </button>
              </div>
            </div>
            <div className="panel-header">
              {visiblePanel === "location" && (
                <button
                  className="icon-button"
                  aria-label="Back to destinations"
                  onClick={() => open("places")}
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <h1 id="workflow-title" tabIndex={-1}>
                {title}
              </h1>
              {(visiblePanel === "directions" || visiblePanel === "mission") && result?.routes.length ? (
                <button className="text-button result-jump" onClick={viewResults}>View results</button>
              ) : null}

              <button
                className="icon-button"
                aria-label="Close panel"
                onClick={() => {
                  switchPanel(null);
                  setPlacement(null);
                  document.querySelector<HTMLElement>(".nav-explore")?.focus();
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="workflow-stack" inert={sheet === "peek" && placement !== null}>
            <ScrollArea className="workflow-view" viewportClassName="panel-scroll" label="Explore destinations"
              active={panel === "places"} {...workflowState("places")}>
                <label className="search">
                  <Search size={18} />
                  <input
                    ref={searchRef}
                    aria-label="Search scientific destinations"
                    placeholder="Search places or science…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      className="icon-button"
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                    >
                      <X size={16} />
                    </button>
                  )}
                </label>
                {onboarding && (
                  <div className="onboarding" role="region" aria-label="Getting started">
                    <button className="icon-button" aria-label="Dismiss getting started" onClick={dismissOnboarding}>
                      <X size={17} />
                    </button>
                    <strong>A field guide to Mars</strong>
                    <p>Explore a destination, inspect a scientific layer, or compare routes between A and B.</p>
                    <button className="text-button" onClick={() => {
                      dismissOnboarding();
                      setKeyboardHelp(false);
                      help.current?.open(helpButton.current);
                    }}>
                      How it works <ArrowUpRight size={15} />
                    </button>
                  </div>
                )}
                {hideFeatured ? (
                  <button className="text-button" onClick={() => setHideFeatured(false)}>Show featured Jezero</button>
                ) : (
                  <section className="jezero-feature" aria-labelledby="featured-jezero">
                    <div className="feature-kicker">
                      <Mountain size={16} aria-hidden="true" />
                      Highest-detail terrain planning
                      <button className="icon-button" aria-label="Hide featured Jezero" onClick={() => setHideFeatured(true)}><X size={16} /></button>
                    </div>
                    <h2 id="featured-jezero">Jezero Crater</h2>
                    <p>Trace ancient water through a crater delta using detailed terrain and published outcrops.</p>
                    <div className="feature-actions">
                      <button className="primary-button" onClick={() => featureJezero(true)}>Plan detailed route</button>
                      <button className="secondary-button" onClick={() => featureJezero(false)}>Explore Jezero</button>
                    </div>
                    <dl className="feature-data">
                      <div><dt>20 m</dt><dd>Terrain grid</dd></div>
                      <div><dt>6 m</dt><dd>CTX imagery</dd></div>
                      <div><dt>0.25 m</dt><dd>Selected HiRISE</dd></div>
                    </dl>
                    <EvidenceLink className="text-link feature-source" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC7116714/#Tab2" target="_blank" rel="noreferrer">Published delta outcrops</EvidenceLink>
                  </section>
                )}
                <Accordion className="place-filters" title={<>
                    Science themes{" "}
                    <span>{tag === "All" ? "All destinations" : tag}</span>
                  </>}>
                  <div
                    className="filters"
                    aria-label="Filter scientific destinations"
                  >
                    {[
                      "All",
                      "Ancient water",
                      "Sediments",
                      "Clays",
                      "Hydrothermal",
                      "Carbonates",
                      "Volcanism",
                    ].map((t) => (
                      <button
                        key={t}
                        aria-pressed={tag === t}
                        className={tag === t ? "chosen" : ""}
                        onClick={() => setTag(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </Accordion>
                <div className="section-title">
                  <span>Scientific destinations</span>
                  <span>{filtered.length}</span>
                </div>
                <div className="destination-list">
                  {filtered.map((l) => (
                    <button
                      className="destination"
                      key={l.id}
                      onClick={() => select(l.id)}
                    >
                      <span className="destination-copy">
                        <strong>{l.name}</strong>
                        <small>{l.category}</small>
                      </span>
                      <ArrowUpRight size={17} />
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="empty">
                      No matches. Try another place or science theme.
                    </p>
                  )}
                </div>
                <p className="small-note panel-footnote">
                  Source-linked research and education. No NASA endorsement.
                </p>
            </ScrollArea>
            {visited.has("layers") && (
              <ScrollArea className="layer-content workflow-view" viewportClassName="panel-scroll" label="Scientific layers"
                active={panel === "layers"} {...workflowState("layers")}>
                <p className="panel-intro">
                  See the surface through different evidence.
                </p>
                <LayerManager
                  active={layerId}
                  displayed={layer}
                  onActive={setLayerId}
                  opacity={layerOpacity}
                  onOpacity={setLayerOpacity}
                  status={overlay}
                  onRetry={() => setLayerRetry((n) => n + 1)}
                />
                <h2 className="section-heading">Orbital imagery</h2>
                <div className="basemap-options">
                  <button
                    aria-pressed={basemap === "optical"}
                    className={basemap === "optical" ? "chosen" : ""}
                    onClick={() => setBasemap("optical")}
                  >
                    <span>Viking optical</span>
                    <small>Global · 232 m</small>
                    {basemap === "optical" && <Check size={16} />}
                  </button>
                  <button
                    aria-pressed={basemap === "relief"}
                    className={basemap === "relief" ? "chosen" : ""}
                    onClick={() => setBasemap("relief")}
                  >
                    <span>MOLA relief</span>
                    <small>Global · 463 m</small>
                    {basemap === "relief" && <Check size={16} />}
                  </button>
                </div>
                <label className="layer-toggle">
                  <span>
                    Topographic relief<small>NASA / USGS MOLA imagery</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={topography}
                    onChange={(e) => setTopography(e.target.checked)}
                  />
                </label>
                <label className="slider-label">
                  Relief opacity<span>{Math.round(opacity * 100)}%</span>
                  <input
                    aria-label="Topography opacity"
                    type="range"
                    min="0"
                    max="1"
                    step=".05"
                    value={opacity}
                    onChange={(e) => setOpacity(+e.target.value)}
                  />
                </label>
                <label className="layer-toggle">
                  <span>
                    Scientific destinations
                    <small>{locations.length} source-linked regions</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={showLocations}
                    onChange={(e) => setShowLocations(e.target.checked)}
                  />
                </label>
                <div className="data-note">
                  <strong>Detail where data exists</strong>
                  <p>
                    CTX 6 m and HiRISE 0.25 m imagery appear as you zoom into
                    Jezero. Imagery resolution does not imply matching terrain
                    resolution.
                  </p>
                </div>
                <EvidenceLink className="text-link" href="/sources/">
                  Dataset sources & limitations</EvidenceLink>
              </ScrollArea>
            )}
            {(visited.has("directions") || visited.has("mission")) && (
              <ScrollArea className="workflow-view" viewportClassName="panel-scroll" viewportRef={attachScroll}
                label={visiblePanel === "mission" ? "Mission planner" : "Directions planner"}
                active={panel === "directions" || panel === "mission"} {...workflowState("directions")}
                onPointerDownCapture={(event) => {
                  if ((event.target as Element).closest(".scroll-track")) interruptScroll();
                }}
                viewportProps={{
                  onWheel: interruptScroll,
                  onTouchMove: interruptScroll,
                  onKeyDown: (event) => {
                    if (["PageDown", "PageUp", "Home", "End", "ArrowDown", "ArrowUp", "Tab"].includes(event.key))
                      interruptScroll();
                  },
                  onPointerDown: (event) => {
                    const target = event.target as Element;
                    if (target === event.currentTarget || target.closest("#route-planning")) interruptScroll();
                  },
                }}>
              {visiblePanel === "mission" && <MissionSetup mission={mission} draft={draft} onChange={updateMission}
                onDraft={setDraft} onObjective={changeObjective} onExample={missionExample} showStudy={showStudy} onStudy={setShowStudy}
                communications={<CommunicationsSetup mission={mission} start={draft.start} mapReady={mapReady} onChange={updateMission}
                  onPlace={() => pick("station")} onRemove={removeStation} />} />}
              <RoutePlanner
                draft={draft}
                mapReady={mapReady}
                settings={settings}
                onDraft={setDraft}
                onRemoveEndpoint={removeEndpoint}
                onSettings={setSettings}
                placement={placement}
                onPlacement={pick}
                result={result}
                collapsed={collapsed}
                onEdit={editRoute}
                pending={engine.pending}
                updating={updating}
                error={engine.error}
                active={selectedIndex}
                recommended={recommended}
                analysis={engine.displayAnalysis}
                exportAnalysis={engine.analysis}
                evidence={engine.displayEvidence}
                exportEvidence={engine.evidence}
                evidenceError={engine.evidenceError}
                analysisUpdating={engine.analysisUpdating}
                analysisError={engine.analysisError}
                rankingPending={engine.rankingPending}
                climatePreferences={climatePreferences}
                mission={visiblePanel === "mission"}
                assumedSpeed={speedKmh}
                onSpeed={(value) => updateMission({ speedKmh: value })}
                missionActions={<div className="mission-exports">
                  <button className="secondary-button" disabled={!selectedRoute} onClick={() => {
                    const brief = makeBrief();
                    if (brief) openMissionBrief(brief);
                  }}>Generate Mission Brief</button>
                  {visiblePanel === "mission" && <button className="text-button" disabled={!selectedRoute} onClick={() => {
                    const brief = makeBrief();
                    if (brief) downloadMission(brief);
                  }}>Export mission GeoJSON</button>}
                </div>}
                missionResults={visiblePanel === "mission" && candidates?.[selectedIndex] && result && <>
                  <MissionJourney mission={mission} outbound={candidates[selectedIndex]} inbound={engine.inbound}
                    onChange={updateMission} revision={engine.geometryKey} />
                  <MissionSensitivity routes={candidates} baseline={baseResult?.scores} ranking={result.ranking}
                    scores={result.scores ?? []} preset={preset} onPreset={(value) => { setPreset(value); setActive(null); }} />
                  <MissionConditions context={missionContext} pending={contextPending} terminator={showTerminator}
                    onTerminator={setShowTerminator} visibility={showVisibility} onVisibility={setShowVisibility} onProfile={setProfilePoint} />
                  {result.meta?.id === terrainMetadata.id && <HistoricalObservations />}
                </>}
                onClimatePreferences={setClimatePreferences}
                onActive={(index) => {
                  const route = engine.result?.routes[index];
                  if (route) setActive({ geometryKey: engine.geometryKey, id: route.id });
                }}
                onRecalculate={() => {
                  setDismissedError(undefined);
                  setRevision((n) => n + 1);
                }}
                onExample={example}
                onFit={() => {
                  setSheet((old) => old === "full" ? "half" : old);
                  const route = engine.result?.routes[selectedIndex];
                  if (route) moveCamera((target) => target.fitRoute(route.coordinates));
                }}
                onProfile={setProfilePoint}
                onExploreGoal={(tag) => {
                  setTag(tag);
                  setQuery("");
                  open("places");
                }}
                scienceSections={scienceSections} onScienceSections={setScienceSections} scienceFocus={scienceFocus}
              />
              </ScrollArea>
            )}
            {visited.has("location") && location && (
              <ScrollArea className="workflow-view" viewportClassName="panel-scroll" viewportRef={locationScroll}
                label="Destination details" active={panel === "location"} {...workflowState("location")}>
                <DestinationGallery key={location.id} images={destinationGallery(location.id)} title={location.name} active={panel === "location"} />
                <div className="location-body">
                  <p className="location-category">{location.category}</p>
                  <p className="coordinates">
                    {coordinateLabel(asLonLat(location.coordinates))}
                  </p>
                  <p className="location-summary">{location.summary}</p>
                  <div className="button-row location-directions">
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setDraft({
                          ...draft,
                          start: asLonLat(location.coordinates),
                        });
                        openDirections();
                      }}
                    >
                      Use as A
                    </button>
                    <button
                      className="primary-button"
                      onClick={() => {
                        setDraft({
                          ...draft,
                          end: asLonLat(location.coordinates),
                        });
                        openDirections();
                      }}
                    >
                      Route here <Route size={17} />
                    </button>
                  </div>
                  {location.id === "jezero" && <div className="mission-card-links">
                    <button className="secondary-button" onClick={missionExample}>Try validated mission example</button>
                    <button className="text-button" onClick={() => { setShowStudy(true); open("mission"); }}>Validated Case Study</button>
                  </div>}
                  {location.id === "jezero" && <HistoricalObservations />}
                  {location.id === "oxia" && <div className="mission-card-links">
                    <button className="secondary-button" onClick={() => featureOxia(false)}>Plan detailed Oxia route</button>
                    <button className="text-button" onClick={() => featureOxia(true)}>Try Oxia terrain example</button>
                    <p className="small-note">Native 20.23 m CTX grid in a 30 km window around the supported landing-site terrain.
                      The Gazetteer marker represents the wider named region.</p>
                  </div>}
                  <button
                    className="text-button"
                    disabled={!mapReady}
                    onClick={() =>
                      map.current?.focus(
                        location.id === "jezero"
                          ? [77.43, 18.46]
                          : asLonLat(location.coordinates),
                        location.id === "jezero" ? 13 : 8,
                      )
                    }
                  >
                    Explore orbital imagery <ArrowUpRight size={16} />
                  </button>
                  <div className="tag-list">
                    {location.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  <h2 className="section-heading">Observations & missions</h2>
                  <p>{location.mission}</p>
                  <h2 className="section-heading">Data availability</h2>
                  <p>
                    {regions.find((r) => r.id === location.id)?.availability}
                  </p>
                  <Accordion className="quality-details" title={<>About this position</>}>
                    <p>{location.coordinateNote}</p>
                    {location.gazetteerExtent && <p>Gazetteer extent · {location.gazetteerExtent}</p>}
                    <EvidenceLink
                      className="text-link"
                      href={location.coordinateSource}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Coordinate evidence</EvidenceLink>
                  </Accordion>
                  <EvidenceLink
                    className="source-link"
                    href={location.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Original scientific source</EvidenceLink>
                  <EvidenceLink className="text-link" href="/sources/">
                    All references & limitations</EvidenceLink>
                </div>
              </ScrollArea>
            )}
          </div>
        </aside>
      <AtlasHelp ref={help} keyboard={keyboardHelp} shortcuts={shortcuts} onShortcuts={setShortcuts} />
    </main>
  );
}
