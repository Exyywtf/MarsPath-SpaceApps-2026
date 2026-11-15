"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import Map from "ol/Map";
import View from "ol/View";
import Projection from "ol/proj/Projection";
import { addProjection } from "ol/proj";
import TileLayer from "ol/layer/Tile";
import LayerGroup from "ol/layer/Group";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import WMTS from "ol/source/WMTS";
import type XYZ from "ol/source/XYZ";
import WMTSTileGrid from "ol/tilegrid/WMTS";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import MultiLineString from "ol/geom/MultiLineString";
import Polygon from "ol/geom/Polygon";
import { Circle, Fill, RegularShape, Stroke, Style, Text } from "ol/style";
import { defaults as defaultControls } from "ol/control";
import Translate from "ol/interaction/Translate";
import { primaryAction } from "ol/events/condition";
import type { Coordinate } from "ol/coordinate";
import type { Pixel } from "ol/pixel";
import { defaults as defaultInteractions } from "ol/interaction/defaults";
import DragPan from "ol/interaction/DragPan";
import KeyboardPan from "ol/interaction/KeyboardPan";
import KeyboardZoom from "ol/interaction/KeyboardZoom";
import Kinetic from "ol/Kinetic";
import { locations, asLonLat, locationFromSearch, destinationZoom } from "@/lib/atlas";
import services from "@/data/services.json";
import {
  coordinateLabel,
  MARS_RADIUS,
  normalizeLon,
  marsDistance,
  type LonLat,
} from "@/lib/mars";
import {
  splitDateLine,
  unwrapRoute,
  type EndpointKind,
  type Placement,
  type PlannerDraft,
} from "@/lib/planner";
import type { LayerDataset } from "@/lib/layers";
import { createObservationLayer, createScientificOverlay, type OverlayState } from "@/lib/scientificOverlay";
import { scienceTargets } from "@/lib/science";
import { prepareReveal, revealPrefix } from "@/lib/routePresentation";
import { installEndpointGestures } from "@/lib/endpointGestures";
import { labelRect, selectMapLabels, type LabelInput, type LabelPlacement } from "@/lib/mapLabels";
import type { MapInsets, MapLayout } from "@/lib/mapLayout";
export type { MapInsets } from "@/lib/mapLayout";

const featuredLabels = new Set(["jezero", "gale", "valles", "oxia", "eridania"]);
const revealTiming = { shortest: 740, longest: 1330, alternative: 270, stagger: 120 };
const marsExtent = [-180, -90, 180, 90];
type MarkerKind = EndpointKind | number;

function endpointStyle(kind: MarkerKind, label: string) {
  const fill = new Fill({ color: kind === "start" ? "#ace5d0" : kind === "end" ? "#ffcb99" : "#e2e9e1" });
  const stroke = new Stroke({ color: "#111d22", width: 2.5 });
  return new Style({
    image: kind === "end"
      ? new RegularShape({ points: 4, radius: 17, angle: Math.PI / 4, fill, stroke })
      : new Circle({ radius: kind === "start" ? 13 : 11, fill, stroke }),
    text: new Text({
      text: label, font: "700 12px sans-serif", fill: new Fill({ color: "#111d22" }),
    }),
  });
}

function measureFrame(instance: Map, getInsets: Props["getInsets"]) {
  const [width, height] = instance.getSize() ?? [0, 0];
  if (!width || !height) return null;
  const [topEdge, rightEdge, bottomEdge, leftEdge] = getInsets(width, height);
  // Keep an actionable map area when a sheet or browser toolbar fills the viewport.
  const top = Math.min(topEdge, height * 0.37), right = Math.min(rightEdge, width * 0.3);
  const bottom = Math.min(bottomEdge, height - top - Math.min(100, height * 0.3));
  const left = Math.min(leftEdge, width - right - Math.min(120, width * 0.38));
  const padding: MapInsets = [top, right, bottom, left];
  return {
    width, height, padding,
    offset: [(left - right) / 2, (bottom - top) / 2] as LonLat,
  };
}

function framedCenter(point: number[], offset: LonLat, resolution: number): LonLat {
  return [point[0] - offset[0] * resolution, point[1] - offset[1] * resolution];
}

export interface MapHandle {
  focus: (point: LonLat, zoom?: number) => void;
  reset: () => void;
  zoomBy: (delta: number) => void;
  rememberInsets: () => void;
  fitRoute: (points: LonLat[]) => void;
  finishReveal: () => void;
  showProfilePoint: (point: LonLat | null) => void;
  refreshLayout: () => void;
}
export interface MapRoute {
  id: string;
  coordinates: LonLat[];
  color: string;
  dash?: number[];
  selected: boolean;
  connectors?: LonLat[][];
}
interface Props {
  selected: string | null;
  basemap: string;
  topography: boolean;
  opacity: number;
  showLocations: boolean;
  onSelect: (id: string) => void;
  onCoordinate: (label: string) => void;
  onImagery: (label: string) => void;
  onTileState: (ok: boolean) => void;
  onReady: () => void;
  onScale: (scale: string) => void;
  draft: PlannerDraft;
  placement: Placement;
  onPlace: (point: LonLat) => void;
  onMovePoint: (kind: MarkerKind, point: LonLat) => void;
  onRemoveEndpoint: (kind: EndpointKind) => void;
  routes: MapRoute[];
  routeGeneration?: number;
  recommendedRoute?: string;
  onRevealState: (drawing: boolean) => void;
  terrainBounds: number[];
  getInsets: (width: number, height: number) => MapInsets;
  getLayout: () => MapLayout;
  onInspect?: (point: LonLat, observationIds?: string[]) => void;
  layer?: LayerDataset | null;
  layerOpacity?: number;
  layerRetry?: number;
  onLayerState?: (state: OverlayState) => void;
  showScience?: boolean;
  onScienceSelect?: (id: string) => void;
}
const MarsMap = forwardRef<MapHandle, Props>(function MarsMap(props, ref) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<Map | null>(null),
    handlers = useRef(props),
    syncMetadata = useRef<() => void>(() => {}),
    refreshLabels = useRef<() => void>(() => {});
  const frame = useRef<ReturnType<typeof measureFrame>>(null);
  const bases = useRef<TileLayer<WMTS>[]>([]),
    markers = useRef<VectorLayer<VectorSource>[]>([]);
  const scalar = useRef<ReturnType<typeof createScientificOverlay>>(null);
  const scienceLayer = useRef<VectorLayer<VectorSource> | null>(null);
  const routeSource = useRef(new VectorSource()),
    endpointSource = useRef(new VectorSource()),
    exitingEndpointSource = useRef(new VectorSource()),
    boundsSource = useRef(new VectorSource()),
    profileSource = useRef(new VectorSource());
  const profileMarker = useRef<Feature<Point> | null>(null);
  const endpointMotion = useRef({
    frame: 0,
    arriving: new globalThis.Map<Feature<Point>, number>(),
    exiting: new globalThis.Map<EndpointKind, { feature: Feature<Point>; from: number; scale: number }>(),
  });
  const reveal = useRef<{
    generation?: number;
    frame: number;
    finish?: () => void;
  }>({ frame: 0 });
  const { routes, routeGeneration, recommendedRoute } = props;
  const routeFeatures = useRef(
    new globalThis.Map<
      string,
      { points: LonLat[]; feature: Feature<MultiLineString> }
    >(),
  );
  useEffect(() => {
    handlers.current = props;
  });
  function duration() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 220;
  }
  const actions = useRef({
    readFrame() {
      return map.current ? measureFrame(map.current, handlers.current.getInsets) : null;
    },
    focus(point: LonLat, zoom: number, time: number) {
      const view = map.current?.getView();
      const targetFrame = this.readFrame();
      if (!view || !targetFrame) return;
      const longitude = point[0] + 360 * Math.round(((view.getCenter()?.[0] ?? 0) - point[0]) / 360);
      const resolution = view.getResolutionForZoom(zoom);
      const center = framedCenter([longitude, point[1]], targetFrame.offset, resolution);
      view.cancelAnimations();
      if (time) view.animate({ center, resolution, duration: time });
      else {
        view.setResolution(resolution);
        view.setCenter(center);
      }
    },
  });
  useImperativeHandle(
    ref,
    () => ({
      refreshLayout: () => refreshLabels.current(),
      focus: (point, zoom = 6) => {
        actions.current.focus(point, zoom, duration());
        syncMetadata.current();
      },
      reset: () => {
        const v = map.current?.getView();
        const targetFrame = actions.current.readFrame();
        if (!v || !targetFrame) return;
        v.cancelAnimations();
        v.fit(v.getProjection().getExtent(), {
          padding: targetFrame.padding,
          duration: duration() || undefined,
        });
        if (v && host.current)
          host.current.dataset.animating = String(v.getAnimating());
      },
      zoomBy: (delta) => {
        const v = map.current?.getView();
        v?.cancelAnimations();
        if (v)
          v.animate({ zoom: (v.getZoom() ?? 1) + delta, duration: duration() });
        if (v && host.current)
          host.current.dataset.animating = String(v.getAnimating());
      },
      rememberInsets: () => {
        const next = actions.current.readFrame();
        if (next?.width === frame.current?.width && next?.height === frame.current?.height)
          frame.current = next;
      },
      fitRoute: (points) => {
        if (!points.length) return;
        const view = map.current?.getView();
        const targetFrame = actions.current.readFrame();
        if (!view || !targetFrame) return;
        const line = new MultiLineString([unwrapRoute(points)]);
        const [west, , east] = line.getExtent();
        const currentLongitude = view.getCenter()?.[0] ?? 0;
        const worldShift =
          360 * Math.round((currentLongitude - (west + east) / 2) / 360);
        line.translate(worldShift, 0);
        view.cancelAnimations();
        view.fit(line, {
          maxZoom: 14,
          padding: targetFrame.padding.map((value) => value + 12),
          duration: duration() || undefined,
        });
        if (host.current)
          host.current.dataset.animating = String(view.getAnimating());
      },
      finishReveal: () => reveal.current.finish?.(),
      showProfilePoint: (point) => {
        if (!point) {
          if (profileMarker.current) {
            profileSource.current.removeFeature(profileMarker.current);
            profileMarker.current = null;
          }
        } else if (profileMarker.current) {
          profileMarker.current.getGeometry()?.setCoordinates(point);
        } else {
          profileMarker.current = new Feature(new Point(point));
          profileSource.current.addFeature(profileMarker.current);
        }
      },
    }),
    [],
  );
  useEffect(() => {
    if (!host.current) return;
    const revealController = reveal.current;
    const projection = new Projection({
      code: "MARSPATH:2000",
      units: "degrees",
      extent: marsExtent,
      worldExtent: marsExtent,
      global: true,
      metersPerUnit: (MARS_RADIUS * Math.PI) / 180,
      getPointResolution: (resolution, point) =>
        resolution * Math.cos((point[1] * Math.PI) / 180),
    });
    addProjection(projection);
    let failures = 0;
    const tiles = services.map((service, i) => {
      const source = new WMTS({
        url: service.url,
        layer: service.id,
        matrixSet: service.matrixSet,
        format: service.format,
        style: service.style,
        requestEncoding: "REST",
        projection,
        tileGrid: new WMTSTileGrid({
          extent: [-180, -90, 180, 90],
          origin: service.origin,
          resolutions: service.resolutions,
          matrixIds: service.matrixIds,
          sizes: service.sizes,
          tileSize: service.tileSize,
        }),
        wrapX: true,
        crossOrigin: "anonymous",
        transition: 0,
        attributions: "NASA / JPL / USGS · Mars Trek",
      });
      source.on("tileloadend", () => {
        if (!failures) handlers.current.onTileState(true);
      });
      source.on("tileloaderror", () => {
        failures++;
        handlers.current.onTileState(false);
      });
      return new TileLayer({
        source,
        zIndex: -2,
        visible: i === 0 || i >= 2,
        minZoom: i === 2 ? 8 : i === 3 ? 12 : undefined,
        extent: i >= 2 ? service.bounds : undefined,
      });
    });
    bases.current = tiles;
    const markerStyles = new globalThis.Map<string, Style>();
    let hovered: string | undefined;
    const markerSource = new VectorSource({
      features: locations.map(
        (l) =>
          new Feature({
            geometry: new Point(asLonLat(l.coordinates)),
            locationId: l.id,
            name: l.name,
          }),
      ),
      wrapX: true,
    });
    const markerLayer = new VectorLayer({
      source: markerSource,
      style: (f) => {
        const id = f.get("locationId"),
          active = id === handlers.current.selected,
          featured = id === "jezero",
          hot = hovered === id;
        const key = [active, featured, hot].join(":");
        if (!markerStyles.has(key)) {
          const fill = new Fill({ color: active || hot ? "#fff0d8" : featured ? "#f9b37b" : "#efc29d" });
          const stroke = new Stroke({ color: "#231e1b", width: active ? 2.6 : 2 });
          markerStyles.set(
            key,
            new Style({
              zIndex: active ? 2 : featured ? 1 : 0,
              image: featured
                ? new RegularShape({ points: 4, radius: active || hot ? 10 : 8, fill, stroke })
                : new Circle({ radius: active || hot ? 7.5 : 5.5, fill, stroke }),
            }),
          );
        }
        return markerStyles.get(key);
      },
    });
    const labelSource = new VectorSource({ wrapX: false });
    for (const l of locations)
      labelSource.addFeature(new Feature({
        geometry: new Point(asLonLat(l.coordinates)), locationId: l.id, name: l.name,
      }));
    const labelMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const labelFont = getComputedStyle(host.current).getPropertyValue("--font-sans").trim() || "sans-serif";
    const context = document.createElement("canvas").getContext("2d")!;
    context.font = "580 13px " + labelFont;
    const measurements = new globalThis.Map<string, { text: string; width: number; height: number }>();
    const labelStates = new globalThis.Map<string, {
      style: Style; alpha: number; from: number; target: number; started: number; placement?: LabelPlacement;
    }>();
    function measureLabel(name: string) {
      const lines: string[] = [];
      for (const word of name.split(" ")) {
        const last = lines.at(-1);
        if (last && context.measureText(last + " " + word).width <= 150) lines[lines.length-1] += " " + word;
        else lines.push(word);
      }
      return { text: lines.join("\n"), width: Math.ceil(Math.max(...lines.map((line) => context.measureText(line).width))) + 14,
        height: lines.length * 16 + 8 };
    }
    for (const feature of labelSource.getFeatures()) {
      const id = String(feature.get("locationId")), size = measureLabel(String(feature.get("name")));
      measurements.set(id, size);
      labelStates.set(id, { alpha: 0, from: 0, target: 0, started: 0, style: new Style({
        text: new Text({ text: size.text, font: "580 13px " + labelFont, textAlign: "center", textBaseline: "middle",
          fill: new Fill(), backgroundFill: new Fill(), backgroundStroke: new Stroke({ width: 1 }), padding: [4, 7, 4, 7] }),
      }) });
    }
    const labelLayer = new VectorLayer({ source: labelSource, declutter: false, updateWhileAnimating: true,
      updateWhileInteracting: true, style: (feature) => {
        const state = labelStates.get(String(feature.get("locationId")))!;
        return state.alpha > 0 && state.placement ? state.style : undefined;
      },
    });
    let labelFrame = 0, labelsDirty = true;
    markers.current = [markerLayer, labelLayer];
    const boundsLayer = new VectorLayer({
      source: boundsSource.current,
      style: new Style({
        stroke: new Stroke({ color: "#94d2b8", width: 1.5, lineDash: [7, 5] }),
        fill: new Fill({ color: "#94d2b808" }),
      }),
    });
    const routeStyles = new globalThis.Map<string, Style[]>();
    const routeLayer = new VectorLayer({
      source: routeSource.current,
      style: (f) => {
        const color = String(f.get("color")),
          selected = !!f.get("selected"),
          connector = !!f.get("connector");
        const dash = f.get("dash") as number[] | undefined;
        const key = [color, selected, connector, dash?.join(",")].join(":");
        if (!routeStyles.has(key)) {
          const zIndex = selected ? 2 : connector ? 3 : 1;
          routeStyles.set(key, [
            new Style({
              zIndex,
              stroke: new Stroke({
                color: "#121b1d",
                width: connector ? 4 : selected ? 8 : 6,
                lineDash: dash,
                lineCap: "round",
                lineJoin: "round",
              }),
            }),
            new Style({
              zIndex,
              stroke: new Stroke({
                color,
                width: connector ? 2 : selected ? 4 : 3,
                lineDash: dash,
                lineCap: "round",
                lineJoin: "round",
              }),
            }),
          ]);
        }
        return routeStyles.get(key);
      },
    });
    const endpointLayer = new VectorLayer({
      source: endpointSource.current,
    });
    const profileLayer = new VectorLayer({
      source: profileSource.current,
      style: new Style({
        image: new Circle({
          radius: 7,
          fill: new Fill({ color: "#fff8ed" }),
          stroke: new Stroke({ color: "#132d28", width: 3 }),
        }),
      }),
    });
    const targetStyles = new globalThis.Map(
      scienceTargets.map((t) => [
        t.id,
        new Style({
          image: new Circle({
            radius: 6,
            fill: new Fill({ color: "#b9caff" }),
            stroke: new Stroke({ color: "#19253a", width: 2 }),
          }),
          text: new Text({
            text: t.unit,
            offsetY: -17,
            font: "500 12px sans-serif",
            fill: new Fill({ color: "#dce5ff" }),
            stroke: new Stroke({ color: "#172127", width: 4 }),
          }),
        }),
      ]),
    );
    const targets = new VectorLayer({
      source: new VectorSource({
        features: scienceTargets.map(
          (t) =>
            new Feature({
              geometry: new Point(t.coordinates),
              scienceId: t.id,
            }),
        ),
      }),
      minZoom: 9,
      visible: handlers.current.showScience,
      style: (f) => targetStyles.get(f.get("scienceId")),
    });
    scienceLayer.current = targets;
    const scalarLayers: [TileLayer<XYZ>, TileLayer<XYZ>] = [
      new TileLayer<XYZ>({ visible: false }), new TileLayer<XYZ>({ visible: false }),
    ];
    const pointLayers: [ReturnType<typeof createObservationLayer>, ReturnType<typeof createObservationLayer>] =
      [createObservationLayer(), createObservationLayer()];
    const coverageLayers: [LayerGroup, LayerGroup] = [new LayerGroup({ visible: false }), new LayerGroup({ visible: false })];
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const overlay = createScientificOverlay(scalarLayers, pointLayers, coverageLayers, projection, motion, (state) => {
      if (host.current) host.current.dataset.overlay = state.active ?? "none";
      handlers.current.onLayerState?.(state);
    });
    scalar.current = overlay;
    const navigation = () => {
      const interactions = defaultInteractions({
        altShiftDragRotate: false,
        pinchRotate: false,
        dragPan: false,
        keyboard: false,
        zoomDuration: duration(),
      });
      interactions.push(
        new DragPan(
          duration() ? { kinetic: new Kinetic(-0.005, 0.05, 100) } : {},
        ),
      );
      interactions.push(new KeyboardPan({ duration: duration() ? 100 : 0 }));
      interactions.push(new KeyboardZoom({ duration: duration() }));
      return interactions;
    };
    const instance = new Map({
      target: host.current,
      layers: [
        ...tiles,
        ...scalarLayers,
        ...coverageLayers,
        ...pointLayers,
        boundsLayer,
        markerLayer,
        labelLayer,
        targets,
        routeLayer,
        new VectorLayer({ source: exitingEndpointSource.current }),
        endpointLayer,
        profileLayer,
      ],
      interactions: navigation(),
      view: new View({
        projection,
        center: [0, 0],
        minZoom: -2,
        maxZoom: 17,
        extent: [-Infinity, -90, Infinity, 90],
        constrainOnlyCenter: true,
        smoothExtentConstraint: false,
        enableRotation: false,
      }),
      controls: defaultControls({
        zoom: false,
        rotate: false,
        attribution: false,
      }),
    });
    map.current = instance;
    const translate = new Translate({ layers: [endpointLayer], hitTolerance: 11, condition: primaryAction });
    instance.addInteraction(translate);
    let translated = false;
    translate.on("translatestart", () => { translated = false; });
    translate.on("translating", () => { translated = true; });
    translate.on("translateend", (e) => {
      if (!translated) return;
      translated = false;
      e.features.forEach((f) => {
        const kind = f.get("kind") as MarkerKind;
        const { draft } = handlers.current;
        const previous = typeof kind === "number" ? draft.waypoints[kind] : draft[kind];
        if (!previous) return;
        const geometry = f.getGeometry() as Point;
        if (e.mapBrowserEvent.originalEvent.type === "pointercancel") {
          geometry.setCoordinates(previous);
          return;
        }
        const [lon, lat] = geometry.getCoordinates();
        const next: LonLat = [normalizeLon(lon), Math.max(-90, Math.min(90, lat))];
        if (next[0] !== previous[0] || next[1] !== previous[1]) handlers.current.onMovePoint(kind, next);
      });
    });
    function mapTap(pixel: Pixel, coordinate: Coordinate) {
      if (Math.abs(coordinate[1]) > 90) return;
      const point: LonLat = [normalizeLon(coordinate[0]), coordinate[1]];
      const hit = instance.forEachFeatureAtPixel(
        pixel,
        (f) => {
          const location = f.get("locationId") as string | undefined,
            science = f.get("scienceId") as string | undefined;
          return location || science ? { location, science } : undefined;
        },
        { hitTolerance: 15, layerFilter: (l) => [markerLayer, labelLayer, targets].some((source) => source === l) },
      );
      if (handlers.current.placement) {
        const target = hit?.location
          ? locations.find((l) => l.id === hit.location)?.coordinates
          : hit?.science
            ? scienceTargets.find((t) => t.id === hit.science)?.coordinates
            : null;
        handlers.current.onPlace(target ? asLonLat(target) : point);
      } else if (hit?.location) handlers.current.onSelect(hit.location);
      else if (hit?.science) handlers.current.onScienceSelect?.(hit.science);
      else if (overlay.getActive()) {
        const layer = overlay.observationLayer();
        const observationIds = layer ? [...new Set(instance.getFeaturesAtPixel(pixel, {
          hitTolerance: 4, layerFilter: (candidate) => candidate === layer,
        }).map((feature) => feature.get("observationId") as string))] : undefined;
        handlers.current.onInspect?.(point, observationIds);
      }
    }
    instance.on("singleclick", (event) => mapTap(event.pixel, event.coordinate));
    const disposeEndpointGestures = installEndpointGestures(instance, (pixel) => {
      const feature = instance.forEachFeatureAtPixel(pixel, (candidate) => candidate, {
        layerFilter: (layer) => layer === endpointLayer,
      });
      const kind = feature?.get("kind") as MarkerKind | undefined;
      return (kind === "start" || kind === "end") && handlers.current.draft[kind] ? kind : undefined;
    }, () => handlers.current, (kind) => handlers.current.onRemoveEndpoint(kind), mapTap);
    let lastPointer = 0;
    instance.on("pointermove", (e) => {
      if (Date.now() - lastPointer >= 100) {
        lastPointer = Date.now();
        handlers.current.onCoordinate(
          Math.abs(e.coordinate[1]) <= 90
            ? coordinateLabel([e.coordinate[0], e.coordinate[1]])
            : "Outside Mars extent",
        );
        const id = !e.dragging && !handlers.current.placement
          ? instance.forEachFeatureAtPixel(e.pixel, (f) => f.get("locationId") as string, {
              layerFilter: (l) => l === markerLayer || l === labelLayer, hitTolerance: 5,
            })
          : undefined;
        if (id !== hovered) {
          hovered = id;
          markerLayer.changed();
        }
      }
    });
    const syncView = () => {
      const v = instance.getView(),
        c = v.getCenter()!,
        z = v.getZoom() ?? 0;
      requestLabels();
      // View metadata changes only on completed moves; no JSON work each frame.
      if (host.current) {
        host.current.dataset.center = JSON.stringify(c);
        host.current.dataset.resolution = String(v.getResolution());
        host.current.dataset.animating = String(
          v.getAnimating() || v.getInteracting(),
        );
        const a = handlers.current.draft.start;
        if (a)
          host.current.dataset.startPixel = JSON.stringify(
            instance.getPixelFromCoordinate([a[0] + 360 * Math.round((c[0] - a[0]) / 360), a[1]]),
          );
        else delete host.current.dataset.startPixel;
      }
      const distance = marsDistance(
        [c[0], c[1]],
        [c[0] + (v.getResolution() ?? 1) * 100, c[1]],
      );
      handlers.current.onScale(
        distance >= 1000
          ? (distance / 1000).toFixed(1) + " km"
          : distance.toFixed(0) + " m",
      );
      const hirise =
        handlers.current.basemap === "optical" &&
        z > 12 &&
        c[0] >= 77.2229331 &&
        c[0] <= 77.583964 &&
        c[1] >= 18.3067994 &&
        c[1] <= 18.669315;
      const ctx =
        handlers.current.basemap === "optical" &&
        z > 8 &&
        c[0] >= 77.1604655 &&
        c[0] <= 77.6991776 &&
        c[1] >= 18.2110274 &&
        c[1] <= 18.7211945;
      handlers.current.onImagery(
        hirise
          ? "HiRISE · 0.25 m imagery"
          : ctx
            ? "CTX · 6 m imagery"
            : handlers.current.basemap === "relief"
              ? "MOLA · 463 m relief"
              : "Viking · 232 m mosaic",
      );
    };
    instance.on("movestart", () => {
      if (host.current) host.current.dataset.animating = "true";
    });
    syncMetadata.current = syncView;
    instance.on("moveend", syncView);
    function requestLabels() {
      labelsDirty = true;
      if (!labelFrame) labelFrame = requestAnimationFrame(paintLabels);
    }
    function paintLabels(now: number) {
      labelFrame = 0;
      if (labelsDirty) {
        labelsDirty = false;
        const center = instance.getView().getCenter() ?? [0, 0];
        const inputs: LabelInput[] = [];
        for (const feature of labelSource.getFeatures()) {
          const id = String(feature.get("locationId")), geometry = feature.getGeometry() as Point;
          const [x, y] = geometry.getCoordinates(), origin = normalizeLon(x);
          const nearest = origin + 360 * Math.round((center[0] - origin) / 360);
          if (Math.abs(nearest - x) > 1e-7) geometry.setCoordinates([nearest, y]);
          const pixel = instance.getPixelFromCoordinate([nearest, y]);
          if (!pixel) continue;
          const size = measurements.get(id)!;
          inputs.push({ id, x: pixel[0], y: pixel[1], width: size.width, height: size.height,
            priority: id === handlers.current.selected ? 0 : id === "jezero" ? 1 : featuredLabels.has(id) ? 2 : 3 });
        }
        const previous = new globalThis.Map<string, LabelPlacement>();
        const exiting = [];
        for (const input of inputs) {
          const state = labelStates.get(input.id)!;
          if (!state.placement) continue;
          state.placement = { ...state.placement, rect: labelRect(input, state.placement.position) };
          if (state.target) previous.set(input.id, state.placement);
          else if (state.alpha > 0) exiting.push(state.placement.rect);
        }
        const layout = handlers.current.getLayout();
        const [width, height] = instance.getSize() ?? [0, 0];
        const available = layout.viewport.width ? layout : {
          viewport: { x: 0, y: 0, width, height }, overlays: [],
        };
        let selected = selectMapLabels(inputs, available, previous, exiting);
        const leaving = new globalThis.Set<string>();
        // An evicted label reserves its old space until its fade completes.
        for (let pass = 0; pass < previous.size; pass++) {
          const newlyLeaving = [...previous].filter(([id]) => !selected.has(id) && !leaving.has(id));
          if (!newlyLeaving.length) break;
          for (const [id] of newlyLeaving) leaving.add(id);
          selected = selectMapLabels(inputs, available, previous,
            [...exiting, ...[...leaving].map((id) => previous.get(id)!.rect)]);
        }
        for (const input of inputs) {
          const state = labelStates.get(input.id)!, next = selected.get(input.id);
          if (next) state.placement = next;
          const target = Number(!!next && handlers.current.showLocations);
          if (target !== state.target) { state.from = state.alpha; state.target = target; state.started = now; }
          const position = state.placement?.rect;
          if (position) {
            const styleText = state.style.getText()!;
            styleText.setOffsetX(position.x + position.width / 2 - input.x);
            styleText.setOffsetY(position.y + position.height / 2 - input.y);
          }
        }
      }
      let moving = false, finishedExit = false;
      for (const [id, state] of labelStates) {
        const t = labelMotion.matches ? 1 : Math.min(1, (now - state.started) / 180);
        const old = state.alpha;
        state.alpha = state.from + (state.target - state.from) * t;
        if (t < 1 && state.from !== state.target) moving = true;
        if (old > 0 && state.alpha === 0) finishedExit = true;
        const active = id === handlers.current.selected, text = state.style.getText()!, alpha = state.alpha;
        text.getFill()?.setColor(active ? [255, 226, 194, alpha] : [255, 245, 231, alpha]);
        text.getBackgroundFill()?.setColor([33, 28, 25, alpha * .95]);
        text.getBackgroundStroke()?.setColor(active ? [249, 179, 123, alpha] : [115, 89, 71, alpha]);
        state.style.setZIndex(active ? 3 : id === "jezero" ? 2 : 1);
      }
      labelLayer.changed();
      if (finishedExit) labelsDirty = true;
      if (moving || labelsDirty) labelFrame = requestAnimationFrame(paintLabels);
    }
    refreshLabels.current = requestLabels;
    instance.getView().on(["change:center", "change:resolution"], requestLabels);
    labelMotion.addEventListener("change", requestLabels);
    let labelsDisposed = false;
    document.fonts.ready.then(() => {
      if (labelsDisposed) return;
      context.font = "580 13px " + labelFont;
      for (const feature of labelSource.getFeatures()) {
        const id = String(feature.get("locationId")), size = measureLabel(String(feature.get("name")));
        measurements.set(id, size);
        labelStates.get(id)!.style.getText()!.setText(size.text);
      }
      requestLabels();
    });
    const resize = () => {
      instance.updateSize();
      const next = actions.current.readFrame();
      if (!next) return;
      const view = instance.getView(), previous = frame.current;
      frame.current = next;
      if (!previous) {
        const linked = locationFromSearch(window.location.search);
        if (linked) actions.current.focus(asLonLat(linked.coordinates), destinationZoom(linked.id), 0);
        else view.fit(projection.getExtent(), { padding: next.padding });
        instance.renderSync();
        if (host.current) host.current.dataset.ready = "true";
        syncView();
        handlers.current.onReady();
      } else if (next.width !== previous.width || next.height !== previous.height) {
        const center = view.getCenter(), resolution = view.getResolution();
        if (center && resolution) {
          view.cancelAnimations();
          const target = framedCenter(center, [-previous.offset[0], -previous.offset[1]], resolution);
          view.setCenter(framedCenter(target, next.offset, resolution));
        }
        instance.once("postrender", syncView);
      }
      instance.render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host.current);
    resize();
    const stop = () => {
      instance.getView().cancelAnimations();
      if (motion.matches) reveal.current.finish?.();
      for (const interaction of instance.getInteractions().getArray().slice())
        instance.removeInteraction(interaction);
      for (const interaction of navigation().getArray())
        instance.addInteraction(interaction);
      instance.addInteraction(translate);
    };
    motion.addEventListener("change", stop);
    return () => {
      cancelAnimationFrame(revealController.frame);
      cancelAnimationFrame(labelFrame);
      labelsDisposed = true;
      labelMotion.removeEventListener("change", requestLabels);
      refreshLabels.current = () => {};
      observer.disconnect();
      motion.removeEventListener("change", stop);
      disposeEndpointGestures();
      overlay.dispose();
      scalar.current = null;
      instance.setTarget(undefined);
      map.current = null;
      frame.current = null;
    };
  }, []);
  useEffect(() => {
    const b = bases.current;
    if (!b.length) return;
    b[0].setVisible(props.basemap === "optical");
    b[1].setVisible(props.basemap === "relief" || props.topography);
    b[1].setOpacity(props.basemap === "relief" ? 1 : props.opacity);
    b[2].setVisible(props.basemap === "optical");
    b[3].setVisible(props.basemap === "optical");
    for (const marker of markers.current) {
      marker.setVisible(props.showLocations);
      marker.changed();
    }
    syncMetadata.current();
  }, [
    props.basemap,
    props.topography,
    props.opacity,
    props.showLocations,
    props.selected,
  ]);
  useEffect(() => {
    const hostElement = host.current;
    const controller = reveal.current;
    const replay = controller.generation !== routeGeneration && routeGeneration !== undefined;
    const wasDrawing = !!controller.finish;
    if (wasDrawing && !replay && routeGeneration !== undefined) controller.finish?.();
    cancelAnimationFrame(controller.frame);
    controller.finish = undefined;
    controller.generation = routeGeneration;
    const toDraw: { id: string; path: ReturnType<typeof prepareReveal>; geometry: MultiLineString }[] = [];
    const keep = new Set<string>();
    function update(
      id: string,
      points: LonLat[],
      color: string,
      selected: boolean,
      dash?: number[],
      connector = false,
    ) {
      keep.add(id);
      const properties = { color, selected, dash, connector };
      const existing = routeFeatures.current.get(id);
      if (existing) {
        if (existing.points !== points) {
          existing.feature.getGeometry()?.setCoordinates(splitDateLine(points));
          existing.points = points;
        }
        existing.feature.setProperties(properties);
        return;
      }
      const feature = new Feature({
        geometry: new MultiLineString(splitDateLine(points)),
        ...properties,
      });
      routeSource.current.addFeature(feature);
      routeFeatures.current.set(id, { points, feature });
    }
    for (const route of routes) {
      update(
        route.id,
        route.coordinates,
        route.color,
        route.selected,
        route.dash,
      );
      if (route.selected)
        route.connectors?.forEach((connector, index) => {
          update(
            route.id + "-connector-" + index,
            connector,
            route.color,
            false,
            [2, 6],
            true,
          );
        });
      if (replay && duration()) {
        const geometry = routeFeatures.current.get(route.id)?.feature.getGeometry();
        if (geometry) {
          geometry.setCoordinates([]);
          toDraw.push({ id: route.id, path: prepareReveal(route.coordinates), geometry });
        }
      }
    }
    for (const [id, { feature }] of routeFeatures.current) {
      if (keep.has(id)) continue;
      routeSource.current.removeFeature(feature);
      routeFeatures.current.delete(id);
    }
    const mark = (state: "drawing" | "complete" | "idle", progress: number) => {
      if (!hostElement) return;
      hostElement.dataset.reveal = state;
      hostElement.dataset.revealProgress = progress.toFixed(3);
    };
    if (!toDraw.length) {
      mark(routes.length ? "complete" : "idle", routes.length ? 1 : 0);
      handlers.current.onRevealState(false);
      return;
    }
    toDraw.sort((a, b) => Number(b.id === recommendedRoute) - Number(a.id === recommendedRoute));
    const mainTime = Math.min(
      revealTiming.longest,
      revealTiming.shortest + Math.log2(1 + toDraw[0].path.parts.reduce((n, p) => n + p.points.length, 0)) * 30,
    );
    const start = performance.now();
    const finish = () => {
      cancelAnimationFrame(controller.frame);
      for (const { geometry, path, id } of toDraw)
        if (!complete.has(id)) geometry.setCoordinates(path.full);
      controller.finish = undefined;
      mark("complete", 1);
      handlers.current.onRevealState(false);
    };
    const complete = new Set<string>();
    controller.finish = finish;
    mark("drawing", 0);
    handlers.current.onRevealState(true);
    const frame = (now: number) => {
      for (const [index, { id, geometry, path }] of toDraw.entries()) {
        if (complete.has(id)) continue;
        const offset = index ? mainTime + (index - 1) * revealTiming.stagger : 0;
        const progress = Math.min(1, (now - start - offset) / (index ? revealTiming.alternative : mainTime));
        if (progress <= 0) continue;
        const eased = progress * progress * (3 - 2 * progress);
        geometry.setCoordinates(revealPrefix(path, eased));
        if (!index) mark("drawing", eased);
        if (progress === 1) complete.add(id);
      }
      if (complete.size === toDraw.length) finish();
      else controller.frame = requestAnimationFrame(frame);
    };
    controller.frame = requestAnimationFrame(frame);
  }, [routes, routeGeneration, recommendedRoute]);
  useEffect(() => {
    const source = endpointSource.current;
    const exiting = exitingEndpointSource.current;
    const motion = endpointMotion.current;
    const { start, end, waypoints } = props.draft;
    const points = [
      [start, "start", "A"],
      [end, "end", "B"],
      ...waypoints.map((p, i) => [p, i, String(i + 1)]),
    ] as [LonLat | null, MarkerKind, string][];
    const remaining = new Set(source.getFeatures() as Feature<Point>[]);
    for (const [point, kind, label] of points) {
      if (!point) continue;
      if (typeof kind !== "number") {
        const previous = motion.exiting.get(kind);
        if (previous) {
          exiting.removeFeature(previous.feature);
          motion.exiting.delete(kind);
        }
      }
      const existing = source.getFeatureById(kind) as Feature<Point> | null;
      if (existing) {
        remaining.delete(existing);
        const geometry = existing.getGeometry()!;
        const [x, y] = geometry.getCoordinates();
        if (x !== point[0] || y !== point[1]) geometry.setCoordinates(point);
        continue;
      }
      const feature = new Feature({ geometry: new Point(point), kind });
      feature.setId(kind);
      const style = endpointStyle(kind, label);
      feature.setStyle(style);
      if (duration()) {
        style.getImage()?.setScale(0.9);
        style.getText()?.setScale(0.9);
        motion.arriving.set(feature, performance.now());
      }
      source.addFeature(feature);
    }
    for (const unused of remaining) {
      motion.arriving.delete(unused);
      source.removeFeature(unused);
      const kind = unused.getId();
      if ((kind === "start" || kind === "end") && duration()) {
        const style = unused.getStyle() as Style;
        motion.exiting.set(kind, { feature: unused, from: performance.now(), scale: style.getImage()!.getScaleArray()[0] });
        exiting.addFeature(unused);
      }
    }
    function settle(now: number) {
      const reduced = !duration();
      for (const [feature, from] of motion.arriving) {
        const progress = reduced ? 1 : Math.min(1, (now - from) / 240);
        const scale = 1 - 0.1 * (1 - progress) ** 3;
        const style = feature.getStyle() as Style;
        style.getImage()?.setScale(scale);
        style.getText()?.setScale(scale);
        feature.changed();
        if (progress >= 1) motion.arriving.delete(feature);
      }
      for (const [kind, { feature, from, scale }] of motion.exiting) {
        const progress = reduced ? 1 : Math.min(1, (now - from) / 140);
        if (progress === 1) {
          exiting.removeFeature(feature);
          motion.exiting.delete(kind);
          continue;
        }
        const style = feature.getStyle() as Style;
        const shrink = scale * (1 - 0.22 * progress);
        style.getImage()?.setScale(shrink);
        style.getImage()?.setOpacity(1 - progress);
        style.getText()?.setScale(shrink);
        style.getText()?.getFill()?.setColor([17, 29, 34, 1 - progress]);
        feature.changed();
      }
      motion.frame = motion.arriving.size || motion.exiting.size ? requestAnimationFrame(settle) : 0;
    }
    if ((motion.arriving.size || motion.exiting.size) && !motion.frame) motion.frame = requestAnimationFrame(settle);
    if (map.current) {
      map.current.once("postrender", syncMetadata.current);
      map.current.render();
    }
  }, [props.draft]);
  useEffect(() => {
    const motion = endpointMotion.current;
    const exiting = exitingEndpointSource.current;
    return () => {
      cancelAnimationFrame(motion.frame);
      motion.frame = 0;
      motion.arriving.clear();
      motion.exiting.clear();
      exiting.clear();
    };
  }, []);
  useEffect(() => {
    boundsSource.current.clear();
    const [w, s, e, n] = props.terrainBounds;
    boundsSource.current.addFeature(
      new Feature(
        new Polygon([
          [
            [w, s],
            [e, s],
            [e, n],
            [w, n],
            [w, s],
          ],
        ]),
      ),
    );
  }, [props.terrainBounds]);
  useEffect(() => {
    scienceLayer.current?.setVisible(!!props.showScience);
  }, [props.showScience]);
  useEffect(() => {
    if (props.placement) host.current?.focus({ preventScroll: true });
  }, [props.placement]);
  useEffect(() => {
    scalar.current?.select(props.layer ?? null);
  }, [props.layer, props.layerRetry]);
  useEffect(() => {
    scalar.current?.setOpacity(props.layerOpacity ?? 0.75);
  }, [props.layerOpacity]);
  return (
    <div
      id="interactive-mars-map"
      ref={host}
      className={"map-canvas" + (props.placement ? " placing" : "")}
      role="region"
      aria-label="Interactive Mars map"
      aria-describedby={props.placement ? "placement-instruction" : undefined}
      tabIndex={0}
      onKeyDown={(e) => {
        if (
          e.key === "Enter" &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          (props.placement || scalar.current?.getActive())
        ) {
          e.preventDefault();
          const view = map.current?.getView();
          const center = view?.getCenter(), resolution = view?.getResolution();
          const targetFrame = actions.current.readFrame();
          const p = center && resolution && targetFrame
            ? framedCenter(center, [-targetFrame.offset[0], -targetFrame.offset[1]], resolution)
            : center;
          if (p) {
            const point: LonLat = [
              normalizeLon(p[0]),
              Math.max(-90, Math.min(90, p[1])),
            ];
            if (props.placement) props.onPlace(point);
            else props.onInspect?.(point);
          }
        }
      }}
    />
  );
});
export default MarsMap;
