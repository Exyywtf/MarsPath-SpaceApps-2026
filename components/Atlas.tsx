"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
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
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Crosshair,
  HelpCircle,
  Layers,
  LoaderCircle,
  Microscope,
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
  type PlannerDraft,
  type Placement,
} from "@/lib/planner";
import { useRouteEngine } from "@/lib/useRouteEngine";
import { useResultsReveal } from "@/lib/useResultsReveal";
import { defaultClimatePreferences } from "@/lib/routeAnalysis";
import type { MapHandle, MapInsets, MapRoute } from "./MarsMap";
import RoutePlanner, { terrainMetadata } from "./RoutePlanner";
import regions from "@/data/regions.json";
import { scientificLayers, layerValue, type LayerId } from "@/lib/layers";
import type { OverlayState } from "@/lib/scientificOverlay";
import { useLayerData } from "@/lib/useLayerData";
import LayerManager, { LayerLegend } from "./LayerManager";
import AtlasHelp from "./AtlasHelp";
import ScrollArea from "./ScrollArea";
import type { DialogHandle } from "./AtlasDialog";
const MarsMap = dynamic(() => import("./MarsMap"), {
  ssr: false,
  loading: () => (
    <div className="map-loading" role="status">
      Loading the Mars atlas…
    </div>
  ),
});
type Workflow = "places" | "layers" | "directions" | "location";
type Panel = Workflow | null;
const noMapRoutes: MapRoute[] = [];
const CoordinateReadout = memo(
  forwardRef<{ set: (s: string) => void }>(function CoordinateReadout(_, ref) {
    const [text, setText] = useState("Planetocentric · east-positive");
    useImperativeHandle(ref, () => ({ set: setText }), []);
    return <span className="footer-coord">{text}</span>;
  }),
);
export default function Atlas() {
  const map = useRef<MapHandle>(null),
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
    [active, setActive] = useState<{ geometryKey: string; id: string } | null>(null),
    [drawing, setDrawing] = useState(false),
    [hideFeatured, setHideFeatured] = useState(false);
  const [climatePreferences, setClimatePreferences] = useState(defaultClimatePreferences);
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
    [inspectPoint, setInspectPoint] = useState<LonLat | null>(null);
  const requestedLayer = scientificLayers.find((l) => l.id === layerId) ?? null;
  const layer = scientificLayers.find((l) => l.id === overlay.active) ?? null,
    inspection = useLayerData(layer, inspectPoint);
  const engine = useRouteEngine(draft, settings, revision, climatePreferences);
  const result = engine.result ?? engine.previous?.result;
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
    directions: panel === "directions", placement: !!placement, expand: expandResults,
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
      if (linked) {
        setSelected(linked.id);
        setWorkflow((old) => ({ panel: "location", lastPanel: "location", visited: new Set([...old.visited, "location"]), leaving: null }));
      }
      try {
        setShortcuts(localStorage.getItem("marspath-shortcuts") !== "off");
        setOnboarding(!linked && !localStorage.getItem("marspath-onboarded"));
      } catch {}
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
      setDraft((old) =>
        placement === "start"
          ? { ...old, start: point }
          : placement === "end"
            ? { ...old, end: point }
            : placement === "waypoint" && old.waypoints.length < 3
              ? { ...old, waypoints: [...old.waypoints, point] }
              : old,
      );
      setPlacement(null);
    },
    [placement],
  );
  const pick = useCallback(
    (p: Placement) => {
      if (p && !mapReady) return;
      setPlacement(p);
      switchPanel("directions");
      setSheet(p ? "peek" : "half");
      setOnboarding(false);
      if (p)
        document
          .getElementById("interactive-mars-map")
          ?.focus({ preventScroll: true });
    },
    [mapReady, switchPanel],
  );
  const mapDidInitialize = useCallback(() => {
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
      if (map.current && mapReady) action(map.current);
      else pendingFocus.current = action;
    });
  }, [mapReady]);
  useEffect(() => () => cancelAnimationFrame(focusFrame.current), []);
  const movePoint = useCallback(
    (kind: "start" | "end" | number, point: LonLat) =>
      setDraft((old) =>
        typeof kind === "number"
          ? {
              ...old,
              waypoints: old.waypoints.map((p, i) => (i === kind ? point : p)),
            }
          : { ...old, [kind]: point },
      ),
    [],
  );
  const select = useCallback(
    (id: string) => {
      const l = locations.find((l) => l.id === id);
      if (!l) return;
      setOnboarding(false);
      if (placement) {
        place(asLonLat(l.coordinates));
        switchPanel("directions");
        return;
      }
      switchPanel("location");
      setSelected(id);
      setSheet("half");
      const point = asLonLat(l.coordinates);
      const zoom = destinationZoom(id);
      moveCamera((target) => target.focus(point, zoom));
    },
    [moveCamera, placement, place, switchPanel],
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
  const featureJezero = useCallback((directions: boolean) => {
    open(directions ? "directions" : "location");
    setSelected("jezero");
    const [west, south, east, north] = terrainMetadata.bounds;
    const focus = (target: MapHandle) => target.fitRoute([[west, south], [east, north]]);
    moveCamera(focus);
  }, [moveCamera, open]);
  const candidates = result?.routes;
  const scores = result?.scores;
  const recommended = scores ? scores.indexOf(Math.min(...scores)) : -1;
  const manual = active && active.geometryKey === engine.geometryKey && candidates
    ? candidates.findIndex((route) => route.id === active.id) : -1;
  const selectedIndex = manual >= 0 ? manual : Math.max(0, recommended);
  const mapRoutes = useMemo<MapRoute[]>(() =>
    !updating && candidates ? candidates.map((route, index) => ({
      id: route.id,
      coordinates: route.coordinates,
      ...routeAppearance(index, recommended, route.tier === "geographic"),
      selected: index === selectedIndex,
      connectors: route.connectors,
    })) : noMapRoutes, [candidates, recommended, selectedIndex, updating]);
  const endMapFeedback = () => {
    if (routeFeedback === "drawing") map.current?.finishReveal();
    if (routeFeedback === "error") setDismissedError(engine.error);
    document.getElementById("interactive-mars-map")?.focus({ preventScroll: true });
  };
  useEffect(() => {
    map.current?.showProfilePoint(null);
  }, [engine.generation, selectedIndex, panel]);
  const getMapInsets = useCallback((width: number, height: number): MapInsets => {
    const header = headerRef.current, footer = footerRef.current;
    const panel = panelRef.current, controls = controlsRef.current;
    const top = header ? header.offsetTop + header.offsetHeight : 0;
    const right = controls ? width - controls.offsetLeft : 0;
    const panelOpen = panel?.dataset.open === "true";
    const sidebar = panelOpen && getComputedStyle(panel).getPropertyValue("--side-panel").trim() === "1";
    const bottom = panelOpen && !sidebar ? height - panel.offsetTop : footer?.offsetHeight ?? 0;
    const left = sidebar ? panel.offsetLeft + panel.offsetWidth : header?.offsetLeft ?? 0;
    return [top + 10, right + 8, bottom + 10, left + 10];
  }, []);
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
    const exiting = leaving?.id === id;
    return {
      "data-active": visiblePanel === id,
      inert: visiblePanel !== id,
      "aria-hidden": visiblePanel !== id || undefined,
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
          : (location?.name ?? "Destination");
  return (
    <main className="atlas page-arrival">
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
          <button
            className={panel === "layers" ? "nav-active" : ""}
            aria-pressed={panel === "layers"}
            onClick={() => open("layers")}
          >
            <Layers size={18} />
            <span>Layers</span>
          </button>
        </nav>
        <div className="header-links">
          <Link href="/sources/" aria-label="Scientific sources" title="Scientific sources">
            <BookOpen size={18} />
            <span>Sources</span>
          </Link>
          <Link href="/methodology/" aria-label="Methodology" title="Methodology">
            <Microscope size={18} aria-hidden="true" />
            <span>Methodology</span>
          </Link>
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
        </div>
      </header>
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
          routes={mapRoutes}
          routeGeneration={engine.generation}
          recommendedRoute={mapRoutes[recommended]?.id}
          onRevealState={updateDrawing}
          terrainBounds={terrainMetadata.bounds}
          getInsets={getMapInsets}
          layer={requestedLayer}
          layerOpacity={layerOpacity}
          layerRetry={layerRetry}
          onLayerState={setOverlay}
          onInspect={setInspectPoint}
          showScience={panel === "directions" || settings.objectives.length > 0}
          onScienceSelect={(id) => {
            openDirections();
            openEditors();
            requestAnimationFrame(() => {
              const target = document.getElementById(id);
              const disclosures: HTMLDetailsElement[] = [];
              let details = target?.closest("details") ?? null;
              while (details) {
                disclosures.push(details);
                details.dataset.openForFocus = "true";
                details.open = true;
                details = details.parentElement?.closest("details") ?? null;
              }
              requestAnimationFrame(() => {
                target?.focus();
                for (const disclosure of disclosures) delete disclosure.dataset.openForFocus;
              });
            });
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
              {placement === "waypoint"
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
            <LayerLegend layer={layer} />
            <span>{layer.kind}</span>
          </div>
        )}
        {layer && inspectPoint && !placement && overlay.phase !== "hiding" && (
          <aside
            className="inspection-card"
            aria-label="Scientific value inspection"
          >
            <button
              className="icon-button"
              aria-label="Close value inspection"
              onClick={() => setInspectPoint(null)}
            >
              <X size={16} />
            </button>
            <span>{layer.name}</span>
            <strong aria-live="polite" aria-atomic="true">
              {inspection.loading
                ? "Loading…"
                : layer.presentation === "historical"
                  ? inspection.covered ? "Historical image coverage" : "Outside historical image coverage"
                  : inspection.value === null
                  ? "No numerical value"
                  : layerValue(inspection.value, layer.id) + " " + layer.unit}
            </strong>
            <p>{coordinateLabel(inspectPoint)}</p>
            <small>
              {layer.id === "topography"
                ? "Interpolated cell-average elevation"
                : layer.presentation === "historical" ? "NASA 2002 illustration; no point dose values"
                  : layer.id === "radiation" ? "Modelled effective dose rate · 700 MV research scenario"
                    : layer.id === "radiation-column" ? "Vertical atmospheric column mass, not a dose estimate"
                      : "Interpolated modelled climatology"}
            </small>
            <a href={layer.sourcePage} target="_blank" rel="noreferrer">
              Source & context ↗
            </a>
          </aside>
        )}
        <footer className="map-footer" ref={footerRef}>
          <CoordinateReadout ref={readout} />
          <span className="scale-indicator">
            <i />
            {scale} / 100 px
          </span>
          <a
            href="https://trek.nasa.gov/mars/"
            target="_blank"
            rel="noreferrer"
          >
            NASA / JPL / USGS · Mars Trek ↗
          </a>
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
            (visiblePanel === "location" ? " detail-panel" : "")
          }
          aria-label={title}
        >
          <div
            className="sheet-grip"
            onPointerDown={(e) => {
              interruptScroll();
              dragStart.current = e.clientY;
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerUp={(e) => {
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
            {visiblePanel === "directions" && result?.routes.length ? (
              <button className="text-button result-jump" onClick={viewResults}>View results</button>
            ) : null}
            <div className="sheet-buttons">
              <button
                className="icon-button"
                aria-label={
                  sheet === "peek" ? "Expand panel" : "Collapse panel"
                }
                onClick={() => {
                  interruptScroll();
                  setSheet(sheet === "peek" ? "half" : "peek");
                }}
              >
                {sheet === "peek" ? (
                  <ChevronUp size={19} />
                ) : (
                  <ChevronDown size={19} />
                )}
              </button>
              <button
                className="icon-button"
                aria-label={
                  sheet === "full" ? "Reduce panel" : "Expand panel fully"
                }
                onClick={() => {
                  interruptScroll();
                  setSheet(sheet === "full" ? "half" : "full");
                }}
              >
                <ChevronUp size={19} />
              </button>
            </div>
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
                    <a className="text-link feature-source" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC7116714/#Tab2" target="_blank" rel="noreferrer">Published delta outcrops <ArrowUpRight size={14} /></a>
                  </section>
                )}
                <details className="place-filters">
                  <summary>
                    Science themes{" "}
                    <span>{tag === "All" ? "All destinations" : tag}</span>
                  </summary>
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
                </details>
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
                    <small>13 source-linked regions</small>
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
                <Link className="text-link" href="/sources/">
                  Dataset sources & limitations ↗
                </Link>
              </ScrollArea>
            )}
            {visited.has("directions") && (
              <ScrollArea className="workflow-view" viewportClassName="panel-scroll" viewportRef={attachScroll}
                label="Directions planner" active={panel === "directions"} {...workflowState("directions")}
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
              <RoutePlanner
                draft={draft}
                mapReady={mapReady}
                settings={settings}
                onDraft={setDraft}
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
                analysisUpdating={engine.analysisUpdating}
                analysisError={engine.analysisError}
                rankingPending={engine.rankingPending}
                climatePreferences={climatePreferences}
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
              />
              </ScrollArea>
            )}
            {visited.has("location") && location && (
              <ScrollArea className="workflow-view" viewportClassName="panel-scroll" viewportRef={locationScroll}
                label="Destination details" active={panel === "location"} {...workflowState("location")}>
                <div className="location-visual">
                  {location.image && (
                    <Image
                      className="location-image"
                      src={location.image}
                      width={1100}
                      height={700}
                      alt={
                        location.imageCaption ||
                        "Source illustration for " + location.name
                      }
                    />
                  )}
                  <span>{location.category}</span>
                </div>
                <div className="location-body">
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
                  <details className="quality-details">
                    <summary>About this position</summary>
                    <p>{location.coordinateNote}</p>
                    <a
                      className="text-link"
                      href={location.coordinateSource}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Coordinate evidence ↗
                    </a>
                  </details>
                  <a
                    className="source-link"
                    href={location.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Original scientific source <ArrowUpRight size={16} />
                  </a>
                  {location.image && (
                    <p className="image-credit">
                      {location.imageCaption} {location.imageCredit}
                    </p>
                  )}
                  <Link className="text-link" href="/sources/">
                    All references & limitations ↗
                  </Link>
                </div>
              </ScrollArea>
            )}
          </div>
        </aside>
      <AtlasHelp ref={help} keyboard={keyboardHelp} shortcuts={shortcuts} onShortcuts={setShortcuts} />
    </main>
  );
}
