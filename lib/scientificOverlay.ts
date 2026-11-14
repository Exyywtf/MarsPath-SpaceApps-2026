import type ImageTile from "ol/ImageTile";
import type TileLayer from "ol/layer/Tile";
import type Projection from "ol/proj/Projection";
import XYZ from "ol/source/XYZ";
import TileGrid from "ol/tilegrid/TileGrid";
import type { LayerDataset, LayerId } from "./layers";
import { prepareLayerInspection } from "./useLayerData";

export type OverlayState = {
  active: LayerId | null;
  phase: "idle" | "loading" | "ready" | "error";
  message: string;
};

const fadeMs = 260;

export function createScientificOverlay(
  layers: [TileLayer<XYZ>, TileLayer<XYZ>],
  projection: Projection,
  reduced: MediaQueryList,
  report: (state: OverlayState) => void,
) {
  const slots = layers.map((layer) => ({ layer, id: null as LayerId | null, weight: 0 }));
  const assets = new Map<LayerId, Promise<XYZ>>();
  let active: LayerId | null = null;
  let opacity = 0.75, request = 0, frame = 0, onTop = -1;
  let queued: (() => void) | undefined;

  function load(dataset: LayerDataset) {
    const existing = assets.get(dataset.id);
    if (existing) return existing;
    const image = new Image();
    image.src = dataset.imageUrl;
    const pending = Promise.all([image.decode(), prepareLayerInspection(dataset)]).then(() => {
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
      });
      source.setTileUrlFunction(() => dataset.imageUrl, dataset.imageUrl);
      return source;
    });
    assets.set(dataset.id, pending);
    pending.catch(() => assets.delete(dataset.id));
    return pending;
  }

  function render() {
    const topAlpha = (slots[onTop]?.weight ?? 0) * opacity;
    // Preserve the effective overlay alpha when stacking opaque rasters during the fade.
    slots.forEach((slot, i) => {
      const alpha = slot.weight * opacity;
      slot.layer.setOpacity(i === onTop || topAlpha === 1 ? alpha : alpha / (1 - topAlpha));
    });
  }

  function fadeTo(index: number) {
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
          slot.layer.setVisible(false);
          slot.layer.setSource(null);
          slot.id = null;
        }
        const next = queued;
        queued = undefined;
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
      active = null;
      report({ active, phase: "idle", message: "Choose a field to inspect" });
      fadeTo(-1);
      return;
    }
    const ready = () => report({
      active,
      phase: "ready",
      message: dataset.presentation === "historical"
        ? "Overlay ready · click to check image coverage"
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
        slots[1 - index].layer.setZIndex(-1);
        next.layer.setZIndex(0);
        next.layer.setSource(source);
        next.layer.setVisible(true);
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
    dispose() { ++request; cancelAnimationFrame(frame); assets.clear(); queued = undefined; },
  };
}
