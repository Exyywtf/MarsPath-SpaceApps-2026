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
  Minus,
  Plus,
  Route,
  Search,
  X,
} from "lucide-react";
import { locations, asLonLat } from "@/lib/atlas";
import { coordinateLabel, type LonLat } from "@/lib/mars";
import {
  defaultSettings,
  emptyDraft,
  routeAppearance,
  routeScore,
  type PlannerDraft,
  type Placement,
} from "@/lib/planner";
import { useRouteEngine } from "@/lib/useRouteEngine";
import type { MapHandle, MapRoute } from "./MarsMap";
import RoutePlanner, { terrainMetadata } from "./RoutePlanner";
import regions from "@/data/regions.json";
import { scientificLayers, layerValue, type LayerId } from "@/lib/layers";
import { useLayerData } from "@/lib/useLayerData";
import LayerManager, { LayerLegend } from "./LayerManager";
const MarsMap = dynamic(() => import("./MarsMap"), {
  ssr: false,
  loading: () => (
    <div className="map-loading" role="status">
      Loading the Mars atlas…
    </div>
  ),
});
type Panel = "places" | "layers" | "directions" | "location" | null;
const CoordinateReadout = memo(
  forwardRef<{ set: (s: string) => void }>(function CoordinateReadout(_, ref) {
    const [text, setText] = useState("Planetocentric · east-positive");
    useImperativeHandle(ref, () => ({ set: setText }), []);
    return <span className="footer-coord">{text}</span>;
  }),
);
export default function Atlas() {
  const map = useRef<MapHandle>(null),
    readout = useRef<{ set: (s: string) => void }>(null),
    panelRef = useRef<HTMLElement>(null),
    searchRef = useRef<HTMLInputElement>(null),
    help = useRef<HTMLDialogElement>(null);
  const [panel, setPanel] = useState<Panel>("places"),
    [selected, setSelected] = useState<string | null>(null),
    [sheet, setSheet] = useState<"peek" | "half" | "full">("half");
  const [draft, setDraft] = useState<PlannerDraft>(emptyDraft),
    [settings, setSettings] = useState(defaultSettings),
    [placement, setPlacement] = useState<Placement>(null),
    [revision, setRevision] = useState(0),
    [active, setActive] = useState<number | null>(null);
  const [query, setQuery] = useState(""),
    [tag, setTag] = useState("All"),
    [basemap, setBasemap] = useState("optical"),
    [topography, setTopography] = useState(false),
    [opacity, setOpacity] = useState(0.45),
    [showLocations, setShowLocations] = useState(true);
  const [imagery, setImagery] = useState("Viking · 232 m mosaic"),
    [scale, setScale] = useState(""),
    [tileState, setTileState] = useState<boolean | null>(null),
    [padding, setPadding] = useState<number[]>([80, 24, 48, 24]);
  const [profileState, setProfileState] = useState<{
      point: LonLat | null;
      key: string;
    }>({ point: null, key: "" }),
    [shortcuts, setShortcuts] = useState(true),
    [onboarding, setOnboarding] = useState(false),
    [restored, setRestored] = useState(false);
  const [layerId, setLayerId] = useState<LayerId | null>(null),
    [layerOpacity, setLayerOpacity] = useState(0.7),
    [layerStatus, setLayerStatus] = useState("Choose a field to inspect"),
    [inspectPoint, setInspectPoint] = useState<LonLat | null>(null);
  const layer = scientificLayers.find((l) => l.id === layerId) ?? null,
    inspection = useLayerData(layer, inspectPoint);
  const engine = useRouteEngine(draft, settings, revision);
  const profileKey = JSON.stringify([draft, settings, revision, active]);
  const setProfilePoint = useCallback(
    (point: LonLat | null) => setProfileState({ point, key: profileKey }),
    [profileKey],
  );
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
      try {
        const saved = JSON.parse(
          sessionStorage.getItem("marspath-draft-v2") || "null",
        );
        const valid = (p: unknown) =>
          Array.isArray(p) &&
          p.length === 2 &&
          p.every(Number.isFinite) &&
          Math.abs(p[1]) <= 90 &&
          p[0] >= -180 &&
          p[0] < 180;
        if (
          saved &&
          (saved.start === null || valid(saved.start)) &&
          (saved.end === null || valid(saved.end)) &&
          Array.isArray(saved.waypoints) &&
          saved.waypoints.length <= 3 &&
          saved.waypoints.every(valid)
        )
          setDraft(saved);
        setShortcuts(localStorage.getItem("marspath-shortcuts") !== "off");
        setOnboarding(!localStorage.getItem("marspath-onboarded"));
      } catch {}
      setRestored(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (restored)
      try {
        sessionStorage.setItem("marspath-draft-v2", JSON.stringify(draft));
        localStorage.setItem("marspath-shortcuts", shortcuts ? "on" : "off");
      } catch {}
  }, [draft, shortcuts, restored]);
  const open = useCallback((next: Panel) => {
    setPanel(next);
    setPlacement(null);
    setSheet("half");
    setOnboarding(false);
    try {
      localStorage.setItem("marspath-onboarded", "1");
    } catch {}
  }, []);
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
  const pick = useCallback((p: Placement) => {
    setPlacement(p);
    setPanel("directions");
    setSheet("peek");
    setOnboarding(false);
    document
      .querySelector<HTMLElement>(".map-canvas")
      ?.focus({ preventScroll: true });
  }, []);
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
        setPanel("directions");
        return;
      }
      setSelected(id);
      setPanel("location");
      setSheet("half");
      map.current?.focus(asLonLat(l.coordinates), id === "valles" ? 4 : 6);
    },
    [placement, place],
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
    map.current?.focus([77.44, 18.46], 11);
  }, []);
  const comparison = useMemo(() => {
    const candidates = engine.result?.routes ?? [];
    const scores = engine.result?.scores ?? routeScore(candidates, settings);
    const recommended = scores.indexOf(Math.min(...scores));
    const selectedIndex =
      active !== null && active < candidates.length
        ? active
        : Math.max(0, recommended);
    const routes: MapRoute[] = candidates.map((route, index) => ({
      id: route.id,
      coordinates: route.coordinates,
      ...routeAppearance(index, recommended, route.tier === "geographic"),
      selected: index === selectedIndex,
      connectors: route.connectors,
    }));
    return { routes, selectedIndex, recommended };
  }, [engine.result, settings, active]);
  useLayoutEffect(() => {
    const update = () => {
      const box = panelRef.current?.getBoundingClientRect(),
        wide = window.innerWidth >= 1280,
        top = window.innerWidth <= 650 ? 180 : 88;
      const next =
        panel && box
          ? wide
            ? [top, 32, 56, box.width + 48]
            : [
                top,
                16,
                Math.min(
                  box.height + 56,
                  Math.max(56, window.innerHeight - top - 64),
                ),
                16,
              ]
          : [top, 24, 56, 24];
      setPadding((old) =>
        old.every((n, i) => Math.abs(n - next[i]) < 1) ? old : next,
      );
    };
    const observer = new ResizeObserver(update);
    if (panelRef.current) observer.observe(panelRef.current);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [panel, sheet]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        e.isComposing ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        help.current?.open
      )
        return;
      if (e.key === "Escape") {
        if (placement) {
          setPlacement(null);
          setSheet("half");
        } else {
          setPanel(null);
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
        help.current?.showModal();
      } else if ((k === "+" || k === "-") && target.closest(".map-canvas")) {
        e.preventDefault();
        map.current?.zoomBy(k === "+" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [shortcuts, open, openDirections, pick, placement]);
  function dismissOnboarding() {
    setOnboarding(false);
    try {
      localStorage.setItem("marspath-onboarded", "1");
    } catch {}
  }
  useEffect(() => {
    if (panel && !placement && document.activeElement !== document.body)
      document.getElementById("workflow-title")?.focus({ preventScroll: true });
  }, [panel, placement]);
  const dragStart = useRef(0);
  const title =
    panel === "places"
      ? "Explore Mars"
      : panel === "layers"
        ? "Map layers"
        : panel === "directions"
          ? "Directions"
          : (location?.name ?? "Destination");
  return (
    <main className="atlas">
      <a className="skip-link" href="#workflow-panel">
        Skip to controls
      </a>
      <a className="skip-link skip-map" href="#interactive-mars-map">
        Skip to map
      </a>
      <header className="topbar">
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
          <Link href="/sources/" aria-label="Scientific sources">
            <BookOpen size={18} />
            <span>Sources</span>
          </Link>
          <button
            aria-label="Help and keyboard shortcuts"
            onClick={() => help.current?.showModal()}
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
          onScale={setScale}
          draft={draft}
          placement={placement}
          onPlace={place}
          onMovePoint={movePoint}
          routes={comparison.routes}
          terrainBounds={terrainMetadata.bounds}
          padding={padding}
          profilePoint={
            profileState.key === profileKey ? profileState.point : null
          }
          layer={layer}
          layerOpacity={layerOpacity}
          onLayerState={setLayerStatus}
          onInspect={setInspectPoint}
          showScience={panel === "directions" || settings.objectives.length > 0}
          onScienceSelect={(id) => {
            openDirections();
            requestAnimationFrame(() => {
              const target = document.getElementById(id);
              let details = target?.closest("details") ?? null;
              while (details) {
                details.open = true;
                details = details.parentElement?.closest("details") ?? null;
              }
              target?.focus();
            });
          }}
        />
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
        <div className="map-controls">
          <button aria-label="Zoom in" onClick={() => map.current?.zoomBy(1)}>
            <Plus size={19} />
          </button>
          <button aria-label="Zoom out" onClick={() => map.current?.zoomBy(-1)}>
            <Minus size={19} />
          </button>
          <button
            aria-label="Recenter global map"
            onClick={() => map.current?.reset()}
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
          <div className="map-legend">
            <strong>{layer.name}</strong>
            <LayerLegend layer={layer} />
            <span>{layer.kind}</span>
          </div>
        )}
        {layer && inspectPoint && !placement && (
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
                : inspection.value === null
                  ? "No numerical value"
                  : layerValue(inspection.value, layer.id) + " " + layer.unit}
            </strong>
            <p>{coordinateLabel(inspectPoint)}</p>
            <small>
              {layer.id === "topography"
                ? "Interpolated cell-average elevation"
                : "Interpolated modelled climatology"}
            </small>
            <a href={layer.sourcePage} target="_blank" rel="noreferrer">
              Source & context ↗
            </a>
          </aside>
        )}
        <footer className="map-footer">
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
      {panel && (
        <aside
          id="workflow-panel"
          tabIndex={-1}
          ref={panelRef}
          className={
            "workflow-panel sheet-" +
            sheet +
            (panel === "directions" ? " directions-panel" : "") +
            (panel === "location" ? " detail-panel" : "")
          }
          aria-label={title}
        >
          <div
            className="sheet-grip"
            onPointerDown={(e) => {
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
            {panel === "location" && (
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
            <div className="sheet-buttons">
              <button
                className="icon-button"
                aria-label={
                  sheet === "peek" ? "Expand panel" : "Collapse panel"
                }
                onClick={() => setSheet(sheet === "peek" ? "half" : "peek")}
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
                onClick={() => setSheet(sheet === "full" ? "half" : "full")}
              >
                <ChevronUp size={19} />
              </button>
            </div>
            <button
              className="icon-button"
              aria-label="Close panel"
              onClick={() => {
                setPanel(null);
                setPlacement(null);
                document.querySelector<HTMLElement>(".nav-explore")?.focus();
              }}
            >
              <X size={20} />
            </button>
          </div>
          <div className="panel-scroll">
            {panel === "places" && (
              <>
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
              </>
            )}
            {panel === "layers" && (
              <div className="layer-content">
                <p className="panel-intro">
                  See the surface through different evidence.
                </p>
                <LayerManager
                  active={layerId}
                  onActive={setLayerId}
                  opacity={layerOpacity}
                  onOpacity={setLayerOpacity}
                  status={inspection.error || layerStatus}
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
              </div>
            )}
            {panel === "directions" && (
              <RoutePlanner
                draft={draft}
                settings={settings}
                onDraft={setDraft}
                onSettings={setSettings}
                placement={placement}
                onPlacement={pick}
                result={engine.result}
                pending={engine.pending}
                error={engine.error}
                active={comparison.selectedIndex}
                recommended={comparison.recommended}
                onActive={setActive}
                onRecalculate={() => setRevision((n) => n + 1)}
                onExample={example}
                onFit={() =>
                  map.current?.fitRoute(
                    engine.result?.routes[comparison.selectedIndex]
                      ?.coordinates ?? [],
                  )
                }
                onProfile={setProfilePoint}
                onExploreGoal={(tag) => {
                  setTag(tag);
                  setQuery("");
                  open("places");
                }}
              />
            )}
            {panel === "location" && location && (
              <>
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
              </>
            )}
          </div>
        </aside>
      )}
      {onboarding && (
        <div className="onboarding" role="region" aria-label="Getting started">
          <button
            className="icon-button"
            aria-label="Dismiss getting started"
            onClick={dismissOnboarding}
          >
            <X size={18} />
          </button>
          <strong>A field guide to Mars</strong>
          <p>
            Explore a place, reveal a layer, or choose A and B to compare
            routes. Every calculation shows its limits.
          </p>
          <button
            className="text-button"
            onClick={() => {
              dismissOnboarding();
              help.current?.showModal();
            }}
          >
            How it works <ArrowUpRight size={15} />
          </button>
        </div>
      )}
      <dialog ref={help} className="help-dialog" aria-labelledby="help-title">
        <div className="panel-header">
          <h2 id="help-title">Your guide to MarsPath</h2>
          <button
            className="icon-button"
            aria-label="Close help"
            onClick={() => help.current?.close()}
          >
            <X size={21} />
          </button>
        </div>
        <div className="help-body">
          <p>
            Explore thirteen scientific destinations, inspect source-linked
            layers, and plan with the terrain available.
          </p>
          <ol>
            <li>
              <strong>Explore:</strong> search a place or select its map marker.
            </li>
            <li>
              <strong>Layers:</strong> choose imagery and scientific context.
            </li>
            <li>
              <strong>Directions:</strong> set A and B, compare candidates and
              inspect their limits.
            </li>
          </ol>
          <h3>Keyboard shortcuts</h3>
          <dl className="shortcut-list">
            {[
              ["/", "Search places"],
              ["L", "Map layers"],
              ["R", "Directions"],
              ["A / B", "Place start / destination"],
              ["Enter", "Inspect at map centre; place point when selecting"],
              ["Arrow keys", "Pan the focused map"],
              ["+ / −", "Zoom the focused map"],
              ["Escape", "Cancel placement or close panel"],
              ["?", "Open this guide"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>
                  <kbd>{k}</kbd>
                </dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <label className="layer-toggle">
            <span>
              Enable character shortcuts
              <small>Ignored while typing in a field.</small>
            </span>
            <input
              type="checkbox"
              checked={shortcuts}
              onChange={(e) => setShortcuts(e.target.checked)}
            />
          </label>
          <p className="small-note">
            Planetocentric latitude, east-positive longitude. Research and
            education; modelled routes do not guarantee safety.
          </p>
          <Link className="text-link" href="/methodology/">
            Read the methods ↗
          </Link>
        </div>
      </dialog>
    </main>
  );
}
