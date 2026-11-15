import type ImageTile from "ol/ImageTile";
import type TileLayer from "ol/layer/Tile";
import type LayerGroup from "ol/layer/Group";
import ImageLayer from "ol/layer/Image";
import ImageStatic from "ol/source/ImageStatic";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { Circle, Fill, RegularShape, Stroke, Style } from "ol/style";
import type Projection from "ol/proj/Projection";
import XYZ from "ol/source/XYZ";
import TileGrid from "ol/tilegrid/TileGrid";
import type { LayerDataset, LayerId } from "./layers";
import { prepareLayerInspection } from "./useLayerData";
import { loadMineralObservations, mineralStyles } from "./explorationScience";
import { terrainCoverage } from "./terrainCoverage";

export type OverlayState = {
  active: LayerId | null;
  phase: "idle" | "loading" | "hiding" | "ready" | "error";
  message: string;
};

const fadeMs = 260;
type PointLayer = VectorLayer<VectorSource<Feature<Point>>>;
type OverlayAsset = { raster: XYZ; regional?: ImageLayer<ImageStatic>[] } | { points: VectorSource<Feature<Point>> };
const pointStyle = {
  crism: new Style({ image: new Circle({ radius: 5, fill: new Fill({ color: mineralStyles.crism.color }),
    stroke: new Stroke({ color: "#131b1c", width: 1.5 }) }) }),
  chloride: new Style({ image: new RegularShape({ points: 4, radius: 5, fill: new Fill({ color: mineralStyles.chloride.color }),
    stroke: new Stroke({ color: "#131b1c", width: 1.5 }) }) }),
  hydrated: new Style({ image: new RegularShape({ points: 3, radius: 6, fill: new Fill({ color: mineralStyles.hydrated.color }),
    stroke: new Stroke({ color: "#131b1c", width: 1.5 }) }) }),
};

export function createObservationLayer(): PointLayer {
  return new VectorLayer({ visible: false, style: (feature) => pointStyle[feature.get("kind") as keyof typeof pointStyle] });
}

export function createScientificOverlay(
  rasters: [TileLayer<XYZ>, TileLayer<XYZ>],
  points: [PointLayer, PointLayer],
  regions: [LayerGroup, LayerGroup],
  projection: Projection,
  reduced: MediaQueryList,
  report: (state: OverlayState) => void,
) {
  const slots = rasters.map((raster, i) => ({ raster, points: points[i], regions: regions[i], id: null as LayerId | null, weight: 0 }));
  const assets = new Map<LayerId, Promise<OverlayAsset>>();
  let active: LayerId | null = null;
  let opacity = 0.75, request = 0, frame = 0, onTop = -1;
  let queued: (() => void) | undefined;

  async function loadAsset(dataset: LayerDataset): Promise<OverlayAsset> {
    if (dataset.presentation === "observations") {
      const [items] = await Promise.all([loadMineralObservations(), prepareLayerInspection(dataset)]);
      const features = items.map((item) => new Feature({
        geometry: new Point(item.point), kind: item.kind, observationId: `${item.kind}:${item.id}`,
      }));
      return { points: new VectorSource({ features, wrapX: true }) };
    }
    const image = new Image();
    image.src = dataset.imageUrl;
    await Promise.all([image.decode(), prepareLayerInspection(dataset)]);
    const [width, height] = dataset.imageSize;
    if (image.naturalWidth !== width || image.naturalHeight !== height)
      throw new Error("Overlay dimensions differ from the dataset manifest.");
    const source = new XYZ({
      projection,
      tileGrid: new TileGrid({
        extent: dataset.bounds,
        origin: [-180, 90],
        resolutions: [360 / width],
        tileSize: [width, height],
      }),
      tileUrlFunction: () => dataset.imageUrl,
      tileLoadFunction: (tile) => (tile as ImageTile).setImage(image),
      wrapX: true,
      transition: 0,
      interpolate: dataset.interpolate,
    });
    source.setTileUrlFunction(() => dataset.imageUrl, dataset.imageUrl);
    if (dataset.presentation === "coverage") {
      const regional = await Promise.all(terrainCoverage.regions.map(async (record) => {
        const image = new Image();
        image.src = record.imageUrl;
        await image.decode();
        if (image.naturalWidth !== record.imageSize[0] || image.naturalHeight !== record.imageSize[1])
          throw new Error("Regional coverage image dimensions differ.");
        return new ImageLayer({ source: new ImageStatic({
          url: record.imageUrl, imageExtent: record.bounds, projection, interpolate: false,
          imageLoadFunction(wrapper) { wrapper.setImage(image); },
        }) });
      }));
      return { raster: source, regional };
    }
    return { raster: source };
  }

  function load(dataset: LayerDataset) {
    const existing = assets.get(dataset.id);
    if (existing) return existing;
    const pending = loadAsset(dataset);
    assets.set(dataset.id, pending);
    pending.catch(() => assets.delete(dataset.id));
    return pending;
  }

  function render() {
    const topAlpha = (slots[onTop]?.weight ?? 0) * opacity;
    // Preserve the effective overlay alpha when stacking opaque rasters during the fade.
    slots.forEach((slot, i) => {
      const alpha = slot.weight * opacity;
      // Marker layers are sparse. Use ordinary fading when a point overlay participates.
      const adjusted = i === onTop || topAlpha === 1 || slots[onTop]?.points.getVisible() ? alpha : alpha / (1 - topAlpha);
      slot.raster.setOpacity(adjusted);
      slot.points.setOpacity(alpha);
      slot.regions.setOpacity(alpha);
    });
  }

  function fadeTo(index: number, settled?: () => void) {
    cancelAnimationFrame(frame);
    const from = slots.map((slot) => slot.weight);
    const started = performance.now();
    function tick(now: number) {
      const time = reduced.matches ? 1 : Math.min(1, (now - started) / fadeMs);
      const t = time * time * (3 - 2 * time);
      slots.forEach((slot, i) => { slot.weight = from[i] * (1 - t) + Number(index === i) * t; });
      render();
      if (time < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
        for (const [i, slot] of slots.entries()) {
          if (i === index) continue;
          for (const layer of [slot.raster, slot.points]) {
            layer.setVisible(false);
            layer.setSource(null);
          }
          slot.regions.setVisible(false);
          slot.regions.getLayers().clear();
          slot.id = null;
        }
        const next = queued;
        queued = undefined;
        settled?.();
        next?.();
      }
    }
    if (reduced.matches || from.every((weight, i) => weight === Number(i === index))) {
      tick(started + fadeMs);
    } else frame = requestAnimationFrame(tick);
  }

  function select(dataset: LayerDataset | null) {
    const id = ++request;
    queued = undefined;
    if (!dataset) {
      const previous = active;
      active = null;
      report({ active: previous, phase: "hiding", message: "Removing map overlay…" });
      fadeTo(-1, () => {
        if (id === request) report({ active: null, phase: "idle", message: "Choose a field to inspect" });
      });
      return;
    }
    const ready = () => report({
      active,
      phase: "ready",
      message: dataset.presentation === "historical"
        ? "Overlay ready · click to check image coverage"
        : dataset.presentation === "observations" ? "Overlay ready · click a marker to inspect"
          : "Overlay ready · click the map to inspect",
    });
    const showing = slots.findIndex((slot) => slot.id === dataset.id);
    if (showing !== -1) {
      active = dataset.id;
      ready();
      fadeTo(showing);
      return;
    }
    report({ active, phase: "loading", message: "Loading map overlay…" });
    void load(dataset).then((source) => {
      if (id !== request) return;
      const display = () => {
        const index = slots.findIndex((slot) => slot.id === null);
        const next = slots[index];
        onTop = index;
        next.id = dataset.id;
        const previous = slots[1 - index];
        for (const layer of [previous.raster, previous.points, previous.regions]) layer.setZIndex(-1);
        for (const layer of [next.raster, next.points, next.regions]) layer.setZIndex(0);
        if ("raster" in source) {
          next.raster.setSource(source.raster);
          next.raster.setVisible(true);
          if (source.regional) {
            next.regions.getLayers().extend(source.regional);
            next.regions.setVisible(true);
          }
        } else {
          next.points.setSource(source.points);
          next.points.setVisible(true);
        }
        active = dataset.id;
        ready();
        fadeTo(index);
      };
      // Finish the visible handoff if both slots are in use. Only the latest waiting layer can start.
      if (frame && slots.every((slot) => slot.id !== null)) queued = display;
      else display();
    }).catch(() => {
      if (id === request)
        report({ active, phase: "error", message: "Overlay or inspection data could not load." });
    });
  }

  return {
    select,
    setOpacity(value: number) { opacity = value; render(); },
    getActive: () => active,
    observationLayer: () => opacity > 0 && active === "minerals" ? slots.find((slot) => slot.id === active)?.points : undefined,
    dispose() { ++request; cancelAnimationFrame(frame); assets.clear(); queued = undefined; },
  };
}
