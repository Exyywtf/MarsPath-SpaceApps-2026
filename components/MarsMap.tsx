"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import Map from "ol/Map";
import View from "ol/View";
import Projection from "ol/proj/Projection";
import { addProjection } from "ol/proj";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import WMTS from "ol/source/WMTS";
import XYZ from "ol/source/XYZ";
import TileGrid from "ol/tilegrid/TileGrid";
import WMTSTileGrid from "ol/tilegrid/WMTS";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import MultiLineString from "ol/geom/MultiLineString";
import Polygon from "ol/geom/Polygon";
import { Circle, Fill, Stroke, Style, Text } from "ol/style";
import { defaults as defaultControls } from "ol/control";
import Translate from "ol/interaction/Translate";
import { defaults as defaultInteractions } from "ol/interaction/defaults";
import DragPan from "ol/interaction/DragPan";
import KeyboardPan from "ol/interaction/KeyboardPan";
import KeyboardZoom from "ol/interaction/KeyboardZoom";
import Kinetic from "ol/Kinetic";
import { locations, asLonLat } from "@/lib/atlas";
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
  type Placement,
  type PlannerDraft,
} from "@/lib/planner";
import type { LayerDataset } from "@/lib/layers";
import { scienceTargets } from "@/lib/science";

export interface MapHandle {
  focus: (point: LonLat, zoom?: number) => void;
  reset: () => void;
  zoomBy: (delta: number) => void;
  centre: () => LonLat | null;
  fitRoute: (points: LonLat[]) => void;
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
  onMovePoint: (kind: "start" | "end" | number, point: LonLat) => void;
  routes: MapRoute[];
  terrainBounds: number[];
  padding: number[];
  profilePoint?: LonLat | null;
  onInspect?: (point: LonLat) => void;
  layer?: LayerDataset | null;
  layerOpacity?: number;
  onLayerState?: (status: string) => void;
  showScience?: boolean;
  onScienceSelect?: (id: string) => void;
}
const MarsMap = forwardRef<MapHandle, Props>(function MarsMap(props, ref) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<Map | null>(null),
    handlers = useRef(props),
    syncMetadata = useRef<() => void>(() => {});
  const bases = useRef<TileLayer<WMTS>[]>([]),
    markers = useRef<VectorLayer<VectorSource> | null>(null);
  const scalar = useRef<TileLayer<XYZ> | null>(null),
    scalarSources = useRef(new globalThis.Map<string, XYZ>());
  const scienceLayer = useRef<VectorLayer<VectorSource> | null>(null);
  const routeSource = useRef(new VectorSource()),
    endpointSource = useRef(new VectorSource()),
    boundsSource = useRef(new VectorSource()),
    profileSource = useRef(new VectorSource());
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
  useImperativeHandle(
    ref,
    () => ({
      focus: (point, zoom = 6) => {
        const v = map.current?.getView();
        v?.cancelAnimations();
        v?.animate({ center: point, zoom, duration: duration() });
        if (v && host.current)
          host.current.dataset.animating = String(v.getAnimating());
      },
      reset: () => {
        const v = map.current?.getView();
        v?.cancelAnimations();
        v?.fit([-180, -90, 180, 90], {
          padding: [24, 24, 24, 24],
          duration: duration(),
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
      centre: () => {
        const p = map.current?.getView().getCenter();
        return p
          ? [normalizeLon(p[0]), Math.max(-90, Math.min(90, p[1]))]
          : null;
      },
      fitRoute: (points) => {
        if (!points.length) return;
        const view = map.current?.getView();
        if (!view) return;
        const line = new MultiLineString([unwrapRoute(points)]);
        const [west, , east] = line.getExtent();
        const currentLongitude = view.getCenter()?.[0] ?? 0;
        const worldShift =
          360 * Math.round((currentLongitude - (west + east) / 2) / 360);
        line.translate(worldShift, 0);
        view.cancelAnimations();
        view.fit(line, {
          maxZoom: 14,
          padding: [30, 30, 30, 30],
          duration: duration(),
        });
        if (host.current)
          host.current.dataset.animating = String(view.getAnimating());
      },
    }),
    [],
  );
  useEffect(() => {
    if (!host.current) return;
    const projection = new Projection({
      code: "MARSPATH:2000",
      units: "degrees",
      extent: [-180, -90, 180, 90],
      worldExtent: [-180, -90, 180, 90],
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
        visible: i === 0 || i >= 2,
        minZoom: i === 2 ? 8 : i === 3 ? 12 : undefined,
        extent: i >= 2 ? service.bounds : undefined,
      });
    });
    bases.current = tiles;
    const markerStyles = new globalThis.Map<string, Style>();
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
      declutter: true,
      style: (f) => {
        const active = f.get("locationId") === handlers.current.selected,
          key = String(f.get("locationId")) + active;
        if (!markerStyles.has(key))
          markerStyles.set(
            key,
            new Style({
              image: new Circle({
                radius: active ? 8 : 6,
                fill: new Fill({ color: active ? "#ffd2a9" : "#edaa79" }),
                stroke: new Stroke({ color: "#171b1e", width: 2 }),
              }),
              text: new Text({
                text: String(f.get("name")),
                offsetY: -20,
                font: (active ? "600" : "500") + " 13px sans-serif",
                fill: new Fill({ color: "#fff7ed" }),
                stroke: new Stroke({ color: "#171b1e", width: 4 }),
              }),
            }),
          );
        return markerStyles.get(key);
      },
    });
    markers.current = markerLayer;
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
              }),
            }),
            new Style({
              zIndex,
              stroke: new Stroke({
                color,
                width: connector ? 2 : selected ? 4 : 3,
                lineDash: dash,
              }),
            }),
          ]);
        }
        return routeStyles.get(key);
      },
    });
    const endpointStyles = new globalThis.Map<string, Style>();
    const endpointLayer = new VectorLayer({
      source: endpointSource.current,
      style: (f) => {
        const label = String(f.get("label"));
        if (!endpointStyles.has(label))
          endpointStyles.set(
            label,
            new Style({
              image: new Circle({
                radius: 13,
                fill: new Fill({
                  color:
                    label === "A"
                      ? "#a3e0c6"
                      : label === "B"
                        ? "#f8c087"
                        : "#e5e9e6",
                }),
                stroke: new Stroke({ color: "#142421", width: 3 }),
              }),
              text: new Text({
                text: label,
                font: "bold 12px sans-serif",
                fill: new Fill({ color: "#142421" }),
              }),
            }),
          );
        return endpointStyles.get(label);
      },
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
    const scalarLayer = new TileLayer<XYZ>({ visible: false });
    scalar.current = scalarLayer;
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
        scalarLayer,
        boundsLayer,
        markerLayer,
        targets,
        routeLayer,
        endpointLayer,
        profileLayer,
      ],
      interactions: navigation(),
      view: new View({
        projection,
        center: [0, 0],
        zoom: 1,
        minZoom: 0,
        maxZoom: 17,
        extent: [-Infinity, -90, Infinity, 90],
        constrainOnlyCenter: true,
        smoothExtentConstraint: false,
        enableRotation: false,
        padding: handlers.current.padding,
      }),
      controls: defaultControls({
        zoom: false,
        rotate: false,
        attribution: false,
      }),
    });
    instance.getView().fit([-180, -90, 180, 90], { padding: [24, 24, 24, 24] });
    map.current = instance;
    const translate = new Translate({ layers: [endpointLayer] });
    instance.addInteraction(translate);
    translate.on("translateend", (e) => {
      e.features.forEach((f) => {
        const p = (f.getGeometry() as Point).getCoordinates();
        handlers.current.onMovePoint(f.get("kind"), [
          normalizeLon(p[0]),
          Math.max(-90, Math.min(90, p[1])),
        ]);
      });
    });
    instance.on("singleclick", (e) => {
      if (Math.abs(e.coordinate[1]) > 90) return;
      const point: LonLat = [normalizeLon(e.coordinate[0]), e.coordinate[1]];
      const hit = instance.forEachFeatureAtPixel(
        e.pixel,
        (f) => {
          const location = f.get("locationId") as string | undefined,
            science = f.get("scienceId") as string | undefined;
          return location || science ? { location, science } : undefined;
        },
        { hitTolerance: 10 },
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
      else if (handlers.current.layer) handlers.current.onInspect?.(point);
    });
    let lastPointer = 0;
    instance.on("pointermove", (e) => {
      if (Date.now() - lastPointer >= 100) {
        lastPointer = Date.now();
        handlers.current.onCoordinate(
          Math.abs(e.coordinate[1]) <= 90
            ? coordinateLabel([e.coordinate[0], e.coordinate[1]])
            : "Outside Mars extent",
        );
      }
    });
    const syncView = () => {
      const v = instance.getView(),
        c = v.getCenter()!,
        z = v.getZoom() ?? 0;
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
            instance.getPixelFromCoordinate(a),
          );
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
    const observer = new ResizeObserver(() => {
      instance.updateSize();
      instance.once("postrender", syncView);
      instance.render();
    });
    observer.observe(host.current);
    handlers.current.onReady();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => {
      instance.getView().cancelAnimations();
      for (const interaction of instance.getInteractions().getArray().slice())
        instance.removeInteraction(interaction);
      for (const interaction of navigation().getArray())
        instance.addInteraction(interaction);
      instance.addInteraction(translate);
    };
    motion.addEventListener("change", stop);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", stop);
      instance.setTarget(undefined);
      map.current = null;
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
    markers.current?.setVisible(props.showLocations);
    markers.current?.changed();
    syncMetadata.current();
  }, [
    props.basemap,
    props.topography,
    props.opacity,
    props.showLocations,
    props.selected,
  ]);
  useEffect(() => {
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
    for (const route of props.routes) {
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
    }
    for (const [id, { feature }] of routeFeatures.current) {
      if (keep.has(id)) continue;
      routeSource.current.removeFeature(feature);
      routeFeatures.current.delete(id);
    }
  }, [props.routes]);
  useEffect(() => {
    endpointSource.current.clear();
    const { start, end, waypoints } = props.draft;
    for (const [p, kind, label] of [
      [start, "start", "A"],
      [end, "end", "B"],
      ...waypoints.map((p, i) => [p, i, String(i + 1)]),
    ] as [LonLat | null, "start" | "end" | number, string][]) {
      if (p)
        endpointSource.current.addFeature(
          new Feature({ geometry: new Point(p), kind, label }),
        );
    }
    if (map.current) {
      map.current.once("postrender", syncMetadata.current);
      map.current.render();
    }
  }, [props.draft]);
  useEffect(() => {
    if (map.current) {
      const v = map.current.getView(),
        centre = v.getCenter()?.slice();
      v.cancelAnimations();
      v.padding = props.padding;
      if (centre) v.setCenter(centre);
      map.current.once("postrender", syncMetadata.current);
      map.current.render();
    }
  }, [props.padding]);
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
    profileSource.current.clear();
    if (props.profilePoint)
      profileSource.current.addFeature(
        new Feature(new Point(props.profilePoint)),
      );
  }, [props.profilePoint]);
  useEffect(() => {
    scienceLayer.current?.setVisible(!!props.showScience);
  }, [props.showScience]);
  useEffect(() => {
    if (props.placement) host.current?.focus({ preventScroll: true });
  }, [props.placement]);
  useEffect(() => {
    const layer = props.layer,
      target = scalar.current;
    if (!target || !map.current) return;
    if (!layer) {
      target.setVisible(false);
      return;
    }
    let source = scalarSources.current.get(layer.id);
    if (!source) {
      const [width, height] = layer.imageSize;
      source = new XYZ({
        projection: map.current.getView().getProjection(),
        tileGrid: new TileGrid({
          extent: layer.bounds,
          origin: [-180, 90],
          resolutions: [360 / width],
          tileSize: [width, height],
        }),
        tileUrlFunction: () => layer.imageUrl,
        wrapX: true,
        crossOrigin: "anonymous",
        transition: duration(),
      });
      source.on("tileloadstart", () => {
        if (handlers.current.layer?.id === layer.id)
          handlers.current.onLayerState?.("Loading map overlay…");
      });
      source.on("tileloadend", () => {
        if (handlers.current.layer?.id === layer.id)
          handlers.current.onLayerState?.(
            "Overlay ready · click the map to inspect",
          );
      });
      source.on("tileloaderror", () => {
        if (handlers.current.layer?.id === layer.id)
          handlers.current.onLayerState?.(
            "Overlay image could not load. Toggle the layer to retry.",
          );
      });
      scalarSources.current.set(layer.id, source);
    }
    target.setSource(source);
    target.setVisible(true);
    target.setOpacity(props.layerOpacity ?? 0.7);
  }, [props.layer, props.layerOpacity]);
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
          (props.placement || props.layer)
        ) {
          e.preventDefault();
          const p = map.current?.getView().getCenter();
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
